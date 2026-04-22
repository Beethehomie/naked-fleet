// ============================================================
// COMPLIANCE MODULE — COMPLIANCE SERVICE
//
// Tracks all legal, regulatory, and licence requirements
// across the fleet, customers, and the company.
//
// ENTITY TYPES:
//   vehicle  → roadworthy cert, vehicle licence, insurance (PDP/operator)
//   customer → driver's licence, PDP permit
//   company  → operator permits, business licences
//
// STATUS LIFECYCLE (auto-calculated from expiryDate):
//   MISSING       → no record exists for a required item
//   VALID         → expiryDate > now + threshold
//   EXPIRING_SOON → expiryDate within threshold days (default: 30)
//   EXPIRED       → expiryDate < now
//
// BUSINESS RULES:
//   1. Status is computed on read — not stored as a static value
//      BUT it IS stored in DB for fast querying and alerting
//   2. A daily refresh job (Phase 13) recalculates all statuses
//   3. Updating a compliance item recalculates its status immediately
//   4. A vehicle with EXPIRED roadworthy or licence should be blocked
//      from new bookings (enforced in booking service via compliance check)
//   5. Soft delete only — compliance history must be preserved
// ============================================================

import { prisma } from '../../config/database'
import { auditService } from '../../shared/audit.service'
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../../shared/errors'
import type {
  CreateComplianceItemDto,
  UpdateComplianceItemDto,
  ListComplianceQuery,
  ExpiringSoonQuery,
} from './compliance.schema'

// ── STATUS CALCULATION ────────────────────────────────────────
// Derives the correct ComplianceStatus from an expiry date.
// This is the single source of truth for status logic.
export function deriveStatus(expiryDate: Date | null | undefined, thresholdDays = 30): string {
  if (!expiryDate) return 'MISSING'

  const now       = new Date()
  const threshold = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000)

  if (expiryDate < now)        return 'EXPIRED'
  if (expiryDate <= threshold) return 'EXPIRING_SOON'
  return 'VALID'
}

export const complianceService = {

  // ── CREATE COMPLIANCE ITEM ──────────────────────────────────
  async createComplianceItem(dto: CreateComplianceItemDto, actorId: string) {

    // Validate referenced entity exists
    if (dto.entityType === 'vehicle' && dto.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, deletedAt: null },
      })
      if (!vehicle) throw new NotFoundError('Vehicle', dto.vehicleId)
    }

    if (dto.entityType === 'customer' && dto.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null },
      })
      if (!customer) throw new NotFoundError('Customer', dto.customerId)
    }

    // Guard: prevent duplicate active compliance items of same type for same entity
    const duplicate = await prisma.complianceItem.findFirst({
      where: {
        type:       dto.type,
        entityType: dto.entityType,
        deletedAt:  null,
        ...(dto.vehicleId  ? { vehicleId:  dto.vehicleId }  : {}),
        ...(dto.customerId ? { customerId: dto.customerId } : {}),
        status: { not: 'EXPIRED' },
      },
    })
    if (duplicate) {
      throw new ConflictError(
        `An active compliance item of type "${dto.type}" already exists for this ${dto.entityType}. ` +
        `Update the existing record or wait for it to expire before adding a new one.`
      )
    }

    // Derive status from expiry date at creation time
    const status = deriveStatus(dto.expiryDate) as
      'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING'

    const item = await prisma.complianceItem.create({
      data: {
        type:        dto.type,
        entityType:  dto.entityType,
        status,
        vehicleId:   dto.vehicleId   ?? null,
        customerId:  dto.customerId  ?? null,
        referenceNo: dto.referenceNo ?? null,
        issueDate:   dto.issueDate   ?? null,
        expiryDate:  dto.expiryDate  ?? null,
        issuingBody: dto.issuingBody ?? null,
        documentUrl: dto.documentUrl ?? null,
        notes:       dto.notes       ?? null,
      },
      include: {
        vehicle:  { select: { registrationNo: true, make: true, model: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'COMPLIANCE_ITEM_CREATED',
      entity:    'compliance_items',
      entityId:  item.id,
      newValues: {
        type:       dto.type,
        entityType: dto.entityType,
        expiryDate: dto.expiryDate,
        status,
      },
    })

    return item
  },

  // ── GET COMPLIANCE ITEM BY ID ───────────────────────────────
  async getComplianceItemById(itemId: string) {
    const item = await prisma.complianceItem.findFirst({
      where: { id: itemId, deletedAt: null },
      include: {
        vehicle:  { select: { id: true, registrationNo: true, make: true, model: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })
    if (!item) throw new NotFoundError('Compliance item', itemId)

    // Always return live-calculated status alongside stored status
    return {
      ...item,
      computedStatus: deriveStatus(item.expiryDate),
      daysToExpiry:   item.expiryDate
        ? Math.ceil((item.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    }
  },

  // ── LIST COMPLIANCE ITEMS ───────────────────────────────────
  async listComplianceItems(
    query:           ListComplianceQuery,
    actorLocationId: string,
    isOwner:         boolean
  ) {
    const { type, status, entityType, vehicleId, customerId, page, limit } = query
    const skip = (page - 1) * limit

    const locationFilter = isOwner
      ? {}
      : {
          OR: [
            { vehicle:  { locationId: actorLocationId } },
            { customer: { locationId: actorLocationId } },
            { entityType: 'company' as const },
          ],
        }

    const where = {
      deletedAt: null,
      ...(type       ? { type }       : {}),
      ...(status     ? { status }     : {}),
      ...(entityType ? { entityType } : {}),
      ...(vehicleId  ? { vehicleId }  : {}),
      ...(customerId ? { customerId } : {}),
      ...locationFilter,
    }

    const [items, total] = await Promise.all([
      prisma.complianceItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { expiryDate: 'asc' }],
        include: {
          vehicle:  { select: { registrationNo: true, make: true, model: true, locationId: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.complianceItem.count({ where }),
    ])

    const now = new Date()
    return {
      data: items.map((item) => ({
        ...item,
        computedStatus: deriveStatus(item.expiryDate),
        daysToExpiry:   item.expiryDate
          ? Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── UPDATE COMPLIANCE ITEM ──────────────────────────────────
  // Recalculates status automatically when expiry date changes
  async updateComplianceItem(
    itemId:  string,
    dto:     UpdateComplianceItemDto,
    actorId: string
  ) {
    const item = await prisma.complianceItem.findFirst({
      where: { id: itemId, deletedAt: null },
    })
    if (!item) throw new NotFoundError('Compliance item', itemId)

    // Validate issue/expiry date order
    const newExpiry = dto.expiryDate ?? item.expiryDate
    const newIssue  = dto.issueDate  ?? item.issueDate
    if (newIssue && newExpiry && newExpiry <= newIssue) {
      throw new ValidationError('Expiry date must be after issue date')
    }

    // Recalculate status from new expiry
    const newStatus = deriveStatus(newExpiry) as
      'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING'

    const updated = await prisma.complianceItem.update({
      where: { id: itemId },
      data: {
        ...(dto.referenceNo !== undefined ? { referenceNo: dto.referenceNo } : {}),
        ...(dto.issueDate   !== undefined ? { issueDate:   dto.issueDate }   : {}),
        ...(dto.expiryDate  !== undefined ? { expiryDate:  dto.expiryDate }  : {}),
        ...(dto.issuingBody !== undefined ? { issuingBody: dto.issuingBody } : {}),
        ...(dto.documentUrl !== undefined ? { documentUrl: dto.documentUrl } : {}),
        ...(dto.notes       !== undefined ? { notes:       dto.notes }       : {}),
        status: newStatus,
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'COMPLIANCE_ITEM_UPDATED',
      entity:    'compliance_items',
      entityId:  itemId,
      oldValues: { status: item.status, expiryDate: item.expiryDate },
      newValues: { ...dto, status: newStatus },
    })

    return {
      ...updated,
      computedStatus: newStatus,
      daysToExpiry:   updated.expiryDate
        ? Math.ceil((updated.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    }
  },

  // ── SOFT DELETE ─────────────────────────────────────────────
  async deleteComplianceItem(itemId: string, actorId: string) {
    const item = await prisma.complianceItem.findFirst({
      where: { id: itemId, deletedAt: null },
    })
    if (!item) throw new NotFoundError('Compliance item', itemId)

    await prisma.complianceItem.update({
      where: { id: itemId },
      data:  { deletedAt: new Date() },
    })

    await auditService.log({
      userId:    actorId,
      action:    'COMPLIANCE_ITEM_DELETED',
      entity:    'compliance_items',
      entityId:  itemId,
      oldValues: { type: item.type, entityType: item.entityType },
    })

    return { success: true }
  },

  // ── GET EXPIRING ITEMS ──────────────────────────────────────
  // Returns items expiring within N days — used for alert dashboard
  // and as the data source for the automation notification layer (Phase 13)
  async getExpiringSoon(query: ExpiringSoonQuery, actorLocationId: string, isOwner: boolean) {
    const { withinDays, entityType, type, locationId } = query

    const now   = new Date()
    const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)

    const effectiveLocationId = isOwner ? (locationId ?? undefined) : actorLocationId

    const locationFilter = effectiveLocationId
      ? {
          OR: [
            { vehicle:  { locationId: effectiveLocationId } },
            { customer: { locationId: effectiveLocationId } },
            { entityType: 'company' as const },
          ],
        }
      : {}

    const items = await prisma.complianceItem.findMany({
      where: {
        deletedAt:  null,
        status:     { in: ['EXPIRING_SOON', 'EXPIRED'] },
        expiryDate: { lte: until },
        ...(entityType ? { entityType } : {}),
        ...(type       ? { type }       : {}),
        ...locationFilter,
      },
      orderBy: { expiryDate: 'asc' },
      include: {
        vehicle:  {
          select: {
            id: true, registrationNo: true, make: true,
            model: true, locationId: true, status: true,
          },
        },
        customer: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true,
          },
        },
      },
    })

    return items.map((item) => ({
      ...item,
      daysToExpiry: item.expiryDate
        ? Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      isExpired: item.expiryDate ? item.expiryDate < now : false,
    }))
  },

  // ── GET COMPLIANCE FOR VEHICLE ──────────────────────────────
  // Returns all compliance items for a vehicle with gap detection —
  // highlights required items that are MISSING entirely
  async getVehicleCompliance(vehicleId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', vehicleId)

    const REQUIRED_VEHICLE_ITEMS = [
      'VEHICLE_LICENCE',
      'ROADWORTHY',
      'INSURANCE_POLICY',
    ] as const

    const items = await prisma.complianceItem.findMany({
      where:   { vehicleId, deletedAt: null, entityType: 'vehicle' },
      orderBy: { type: 'asc' },
    })

    const now = new Date()
    const itemsWithStatus = items.map((item) => ({
      ...item,
      computedStatus: deriveStatus(item.expiryDate),
      daysToExpiry:   item.expiryDate
        ? Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }))

    // Gap detection — which required items are missing entirely
    const existingTypes = new Set(items.map((i) => i.type))
    const missingItems  = REQUIRED_VEHICLE_ITEMS.filter((t) => !existingTypes.has(t))

    // Overall compliance health
    const hasExpired      = itemsWithStatus.some((i) => i.computedStatus === 'EXPIRED')
    const hasExpiringSoon = itemsWithStatus.some((i) => i.computedStatus === 'EXPIRING_SOON')
    const hasMissing      = missingItems.length > 0

    const overallStatus = hasExpired || hasMissing
      ? 'NON_COMPLIANT'
      : hasExpiringSoon
      ? 'ATTENTION_NEEDED'
      : 'COMPLIANT'

    return {
      vehicleId,
      registrationNo: vehicle.registrationNo,
      overallStatus,
      items:          itemsWithStatus,
      missingItems:   missingItems.map((type) => ({
        type,
        status: 'MISSING',
        message: `No ${type.replace(/_/g, ' ').toLowerCase()} record found`,
      })),
      isBookable: overallStatus !== 'NON_COMPLIANT',
    }
  },

  // ── GET COMPLIANCE FOR CUSTOMER ─────────────────────────────
  async getCustomerCompliance(customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer', customerId)

    const items = await prisma.complianceItem.findMany({
      where:   { customerId, deletedAt: null, entityType: 'customer' },
      orderBy: { type: 'asc' },
    })

    const now = new Date()
    const itemsWithStatus = items.map((item) => ({
      ...item,
      computedStatus: deriveStatus(item.expiryDate),
      daysToExpiry:   item.expiryDate
        ? Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }))

    // Also check the denormalised licence fields on the Customer record itself
    const licenceStatus = customer.licenceExpiry
      ? deriveStatus(customer.licenceExpiry)
      : 'MISSING'

    const hasExpired      = itemsWithStatus.some((i) => i.computedStatus === 'EXPIRED')
      || licenceStatus === 'EXPIRED'
    const hasExpiringSoon = itemsWithStatus.some((i) => i.computedStatus === 'EXPIRING_SOON')
      || licenceStatus === 'EXPIRING_SOON'
    const hasMissingLicence = !customer.driversLicence

    const overallStatus = hasExpired || hasMissingLicence
      ? 'NON_COMPLIANT'
      : hasExpiringSoon
      ? 'ATTENTION_NEEDED'
      : 'COMPLIANT'

    return {
      customerId,
      fullName:      `${customer.firstName} ${customer.lastName}`,
      overallStatus,
      canRent:       overallStatus !== 'NON_COMPLIANT',
      driversLicence: {
        number:      customer.driversLicence,
        expiry:      customer.licenceExpiry,
        status:      hasMissingLicence ? 'MISSING' : licenceStatus,
        daysToExpiry: customer.licenceExpiry
          ? Math.ceil((customer.licenceExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      },
      items: itemsWithStatus,
    }
  },

  // ── BULK STATUS REFRESH ─────────────────────────────────────
  // Recalculates and updates the stored status for ALL compliance items.
  // Called daily by the automation scheduler (Phase 13).
  // Returns counts of how many items changed status.
  async refreshAllStatuses(thresholdDays = 30) {
    const items = await prisma.complianceItem.findMany({
      where:  { deletedAt: null },
      select: { id: true, expiryDate: true, status: true },
    })

    const updates: { id: string; newStatus: string; oldStatus: string }[] = []

    for (const item of items) {
      const newStatus = deriveStatus(item.expiryDate, thresholdDays)
      if (newStatus !== item.status) {
        updates.push({ id: item.id, newStatus, oldStatus: item.status })
      }
    }

    if (updates.length === 0) {
      return { updated: 0, unchanged: items.length, details: [] }
    }

    // Batch update — group by new status for efficiency
    const groupedByStatus = updates.reduce<Record<string, string[]>>((acc, u) => {
      if (!acc[u.newStatus]) acc[u.newStatus] = []
      acc[u.newStatus].push(u.id)
      return acc
    }, {})

    await Promise.all(
      Object.entries(groupedByStatus).map(([status, ids]) =>
        prisma.complianceItem.updateMany({
          where: { id: { in: ids } },
          data:  { status: status as 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING' },
        })
      )
    )

    return {
      updated:   updates.length,
      unchanged: items.length - updates.length,
      details:   updates.map((u) => ({
        id:        u.id,
        oldStatus: u.oldStatus,
        newStatus: u.newStatus,
      })),
    }
  },

  // ── COMPLIANCE DASHBOARD ────────────────────────────────────
  // High-level overview for the owner / manager dashboard
  async getComplianceDashboard(actorLocationId: string, isOwner: boolean) {
    const locationFilter = isOwner
      ? {}
      : {
          OR: [
            { vehicle:  { locationId: actorLocationId } },
            { customer: { locationId: actorLocationId } },
            { entityType: 'company' as const },
          ],
        }

    const [
      byStatus,
      byType,
      byEntity,
      expiredCount,
      expiringSoonCount,
    ] = await Promise.all([
      prisma.complianceItem.groupBy({
        by:    ['status'],
        where: { deletedAt: null, ...locationFilter },
        _count:{ id: true },
      }),
      prisma.complianceItem.groupBy({
        by:    ['type'],
        where: { deletedAt: null, ...locationFilter },
        _count:{ id: true },
      }),
      prisma.complianceItem.groupBy({
        by:    ['entityType'],
        where: { deletedAt: null, ...locationFilter },
        _count:{ id: true },
      }),
      prisma.complianceItem.count({
        where: { deletedAt: null, status: 'EXPIRED', ...locationFilter },
      }),
      prisma.complianceItem.count({
        where: { deletedAt: null, status: 'EXPIRING_SOON', ...locationFilter },
      }),
    ])

    const totalItems   = byStatus.reduce((s, r) => s + r._count.id, 0)
    const validCount   = byStatus.find((r) => r.status === 'VALID')?._count.id ?? 0
    const complianceRate = totalItems > 0
      ? `${((validCount / totalItems) * 100).toFixed(1)}%`
      : '100%'

    return {
      summary: {
        total:          totalItems,
        valid:          validCount,
        expiringSoon:   expiringSoonCount,
        expired:        expiredCount,
        complianceRate,
        needsAttention: expiredCount + expiringSoonCount,
      },
      byStatus:   byStatus.map((r) => ({ status: r.status, count: r._count.id })),
      byType:     byType.map((r)   => ({ type: r.type, count: r._count.id })),
      byEntity:   byEntity.map((r) => ({ entityType: r.entityType, count: r._count.id })),
    }
  },
}
