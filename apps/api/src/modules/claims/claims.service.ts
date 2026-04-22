// ============================================================
// INSURANCE & CLAIMS MODULE — CLAIMS SERVICE
//
// Manages the full insurance and claims lifecycle:
//
//  InsurancePolicy  →  attached to vehicles
//  Claim            →  raised against a vehicle (and optionally a booking)
//  Claim Status     →  OPEN → UNDER_REVIEW → APPROVED/REJECTED → SETTLED → CLOSED
//
// BUSINESS RULES:
//   1. Each vehicle can have multiple insurance policies over time,
//      but only ONE should be active at a time
//   2. Claims reference the active policy at the time of the incident
//   3. Claim status transitions are strictly ordered (no skipping)
//   4. When a claim is SETTLED, settledAmount and excessPaid are recorded
//   5. Settled claims create a VehicleCost (repair cost) automatically
//   6. A claim for THEFT sets vehicle status to RETIRED (total loss)
//   7. REJECTED claims are closed with no financial impact
//   8. All transitions are audit-logged
// ============================================================

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../../config/database'
import { auditService } from '../../shared/audit.service'
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  UnprocessableError,
} from '../../shared/errors'
import type {
  CreateInsurancePolicyDto,
  UpdateInsurancePolicyDto,
  OpenClaimDto,
  UpdateClaimDto,
  AdvanceClaimStatusDto,
  ListClaimsQuery,
  ListPoliciesQuery,
} from './claims.schema'

// ── STATUS TRANSITION GUARD ────────────────────────────────────
// Valid forward-only transitions for claim lifecycle
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN:         ['UNDER_REVIEW', 'CLOSED'],          // CLOSED = withdrawn before review
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED:     ['SETTLED'],
  REJECTED:     ['CLOSED'],
  SETTLED:      ['CLOSED'],
  CLOSED:       [],                                   // Terminal state
}

// ── REF GENERATOR ─────────────────────────────────────────────
async function generateClaimRef(): Promise<string> {
  const year  = new Date().getFullYear()
  const count = await prisma.claim.count({
    where: { claimRef: { startsWith: `CL-${year}-` } },
  })
  return `CL-${year}-${String(count + 1).padStart(5, '0')}`
}

export const claimsService = {

  // ──────────────────────────────────────────────────────────
  // INSURANCE POLICIES
  // ──────────────────────────────────────────────────────────

  // ── CREATE INSURANCE POLICY ─────────────────────────────────
  async createInsurancePolicy(dto: CreateInsurancePolicyDto, actorId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', dto.vehicleId)

    // Deactivate any existing active policies for this vehicle
    const existing = await prisma.insurancePolicy.findMany({
      where: { vehicleId: dto.vehicleId, isActive: true, deletedAt: null },
    })
    if (existing.length > 0) {
      await prisma.insurancePolicy.updateMany({
        where: { vehicleId: dto.vehicleId, isActive: true, deletedAt: null },
        data:  { isActive: false },
      })
    }

    const policy = await prisma.insurancePolicy.create({
      data: {
        vehicleId:    dto.vehicleId,
        provider:     dto.provider,
        policyNumber: dto.policyNumber,
        coverType:    dto.coverType,
        premium:      new Decimal(dto.premium.toString()),
        excess:       new Decimal(dto.excess.toString()),
        startDate:    dto.startDate,
        endDate:      dto.endDate,
        documentUrl:  dto.documentUrl ?? null,
        isActive:     true,
      },
      include: {
        vehicle: { select: { registrationNo: true, make: true, model: true } },
      },
    })

    // Also update vehicle record's insurancePolicyNo for quick reference
    await prisma.vehicle.update({
      where: { id: dto.vehicleId },
      data:  { insurancePolicyNo: dto.policyNumber },
    })

    await auditService.log({
      userId:    actorId,
      action:    'INSURANCE_POLICY_CREATED',
      entity:    'insurance_policies',
      entityId:  policy.id,
      newValues: {
        vehicleId:    dto.vehicleId,
        provider:     dto.provider,
        policyNumber: dto.policyNumber,
        coverType:    dto.coverType,
        premium:      dto.premium,
        excess:       dto.excess,
        endDate:      dto.endDate,
      },
    })

    return policy
  },

  // ── GET POLICY BY ID ────────────────────────────────────────
  async getPolicyById(policyId: string) {
    const policy = await prisma.insurancePolicy.findFirst({
      where: { id: policyId, deletedAt: null },
      include: {
        vehicle: {
          select: { id: true, registrationNo: true, make: true, model: true, year: true },
        },
        claims: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, claimRef: true, type: true,
            status: true, incidentDate: true,
            estimatedCost: true, settledAmount: true,
          },
        },
      },
    })
    if (!policy) throw new NotFoundError('Insurance policy', policyId)
    return policy
  },

  // ── LIST POLICIES ────────────────────────────────────────────
  async listPolicies(query: ListPoliciesQuery, actorLocationId: string, isOwner: boolean) {
    const { vehicleId, isActive, page, limit } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(vehicleId !== undefined ? { vehicleId } : {}),
      ...(isActive  !== undefined ? { isActive }  : {}),
      vehicle: {
        deletedAt:  null,
        locationId: isOwner ? undefined : actorLocationId,
      },
    }

    const [policies, total] = await Promise.all([
      prisma.insurancePolicy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: {
          vehicle: { select: { registrationNo: true, make: true, model: true } },
          _count:  { select: { claims: { where: { deletedAt: null } } } },
        },
      }),
      prisma.insurancePolicy.count({ where }),
    ])

    const now = new Date()
    return {
      data: policies.map((p) => ({
        ...p,
        premium:     Number(p.premium),
        excess:      Number(p.excess),
        claimCount:  p._count.claims,
        isExpired:   p.endDate < now,
        daysToExpiry: p.endDate > now
          ? Math.ceil((p.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── UPDATE POLICY ────────────────────────────────────────────
  async updatePolicy(policyId: string, dto: UpdateInsurancePolicyDto, actorId: string) {
    const policy = await prisma.insurancePolicy.findFirst({
      where: { id: policyId, deletedAt: null },
    })
    if (!policy) throw new NotFoundError('Insurance policy', policyId)

    const updated = await prisma.insurancePolicy.update({
      where: { id: policyId },
      data: {
        ...(dto.provider     ? { provider:     dto.provider }                               : {}),
        ...(dto.policyNumber ? { policyNumber: dto.policyNumber }                           : {}),
        ...(dto.coverType    ? { coverType:    dto.coverType }                              : {}),
        ...(dto.premium      ? { premium:      new Decimal(dto.premium.toString()) }        : {}),
        ...(dto.excess       ? { excess:       new Decimal(dto.excess.toString()) }         : {}),
        ...(dto.startDate    ? { startDate:    dto.startDate }                              : {}),
        ...(dto.endDate      ? { endDate:      dto.endDate }                                : {}),
        ...(dto.documentUrl  ? { documentUrl:  dto.documentUrl }                            : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive }                        : {}),
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'INSURANCE_POLICY_UPDATED',
      entity:    'insurance_policies',
      entityId:  policyId,
      oldValues: { premium: Number(policy.premium), excess: Number(policy.excess), endDate: policy.endDate },
      newValues: dto,
    })

    return updated
  },

  // ── POLICIES EXPIRING SOON ───────────────────────────────────
  async getExpiringPolicies(withinDays = 30, actorLocationId: string, isOwner: boolean) {
    const now   = new Date()
    const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)

    const policies = await prisma.insurancePolicy.findMany({
      where: {
        deletedAt: null,
        isActive:  true,
        endDate:   { gte: now, lte: until },
        vehicle: {
          deletedAt:  null,
          locationId: isOwner ? undefined : actorLocationId,
        },
      },
      orderBy: { endDate: 'asc' },
      include: {
        vehicle: {
          select: { registrationNo: true, make: true, model: true, locationId: true },
        },
      },
    })

    return policies.map((p) => ({
      ...p,
      premium:      Number(p.premium),
      excess:       Number(p.excess),
      daysToExpiry: Math.ceil((p.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }))
  },

  // ──────────────────────────────────────────────────────────
  // CLAIMS
  // ──────────────────────────────────────────────────────────

  // ── OPEN A CLAIM ─────────────────────────────────────────────
  async openClaim(dto: OpenClaimDto, actorId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', dto.vehicleId)

    // Validate booking reference if provided
    if (dto.bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { id: dto.bookingId, vehicleId: dto.vehicleId, deletedAt: null },
      })
      if (!booking) {
        throw new ValidationError(
          'Booking not found or does not belong to this vehicle'
        )
      }
    }

    // Validate insurance policy if provided
    if (dto.insurancePolicyId) {
      const policy = await prisma.insurancePolicy.findFirst({
        where: { id: dto.insurancePolicyId, vehicleId: dto.vehicleId, deletedAt: null },
      })
      if (!policy) {
        throw new ValidationError(
          'Insurance policy not found or does not belong to this vehicle'
        )
      }
    }

    const claimRef = await generateClaimRef()

    const claim = await prisma.claim.create({
      data: {
        claimRef,
        vehicleId:         dto.vehicleId,
        bookingId:         dto.bookingId         ?? null,
        insurancePolicyId: dto.insurancePolicyId ?? null,
        type:              dto.type,
        status:            'OPEN',
        description:       dto.description,
        incidentDate:      dto.incidentDate,
        incidentLocation:  dto.incidentLocation  ?? null,
        estimatedCost:     dto.estimatedCost
                             ? new Decimal(dto.estimatedCost.toString())
                             : null,
        notes:             dto.notes             ?? null,
        managedById:       actorId,
      },
      include: {
        vehicle:  { select: { registrationNo: true, make: true, model: true } },
        booking:  { select: { bookingRef: true } },
        managedBy:{ select: { firstName: true, lastName: true } },
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'CLAIM_OPENED',
      entity:    'claims',
      entityId:  claim.id,
      newValues: {
        claimRef,
        vehicleId:    dto.vehicleId,
        type:         dto.type,
        incidentDate: dto.incidentDate,
        estimatedCost:dto.estimatedCost,
      },
    })

    return claim
  },

  // ── GET CLAIM BY ID ──────────────────────────────────────────
  async getClaimById(claimId: string) {
    const claim = await prisma.claim.findFirst({
      where: { id: claimId, deletedAt: null },
      include: {
        vehicle: {
          select: {
            id: true, registrationNo: true, make: true,
            model: true, year: true, status: true,
          },
        },
        booking: {
          select: {
            bookingRef: true,
            customer:   { select: { firstName: true, lastName: true, phone: true } },
          },
        },
        insurancePolicy: {
          select: {
            provider: true, policyNumber: true,
            coverType: true, excess: true,
          },
        },
        damageItems: {
          select: {
            location: true, description: true, severity: true,
            estimatedCost: true, actualCost: true, photoUrl: true,
          },
        },
        documents: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        managedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    })

    if (!claim) throw new NotFoundError('Claim', claimId)
    return claim
  },

  // ── LIST CLAIMS ──────────────────────────────────────────────
  async listClaims(query: ListClaimsQuery, actorLocationId: string, isOwner: boolean) {
    const { status, type, vehicleId, bookingId, from, to, page, limit } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(status    ? { status }    : {}),
      ...(type      ? { type }      : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(bookingId ? { bookingId } : {}),
      ...(from || to
        ? { incidentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}
      ),
      vehicle: {
        deletedAt:  null,
        locationId: isOwner ? undefined : actorLocationId,
      },
    }

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle:   { select: { registrationNo: true, make: true, model: true } },
          booking:   { select: { bookingRef: true } },
          managedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.claim.count({ where }),
    ])

    return {
      data: claims.map((c) => ({
        ...c,
        estimatedCost: c.estimatedCost ? Number(c.estimatedCost) : null,
        settledAmount: c.settledAmount  ? Number(c.settledAmount) : null,
        excessPaid:    c.excessPaid     ? Number(c.excessPaid)    : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── UPDATE CLAIM ─────────────────────────────────────────────
  async updateClaim(claimId: string, dto: UpdateClaimDto, actorId: string) {
    const claim = await prisma.claim.findFirst({
      where: { id: claimId, deletedAt: null },
    })
    if (!claim) throw new NotFoundError('Claim', claimId)
    if (claim.status === 'CLOSED') {
      throw new UnprocessableError('Cannot update a closed claim')
    }

    const updated = await prisma.claim.update({
      where: { id: claimId },
      data: {
        ...(dto.description       ? { description:       dto.description }                          : {}),
        ...(dto.incidentLocation  ? { incidentLocation:  dto.incidentLocation }                     : {}),
        ...(dto.estimatedCost     ? { estimatedCost:     new Decimal(dto.estimatedCost.toString()) } : {}),
        ...(dto.insurancePolicyId ? { insurancePolicyId: dto.insurancePolicyId }                    : {}),
        ...(dto.notes             ? { notes:             dto.notes }                                : {}),
        managedById: actorId,
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'CLAIM_UPDATED',
      entity:    'claims',
      entityId:  claimId,
      newValues: dto,
    })

    return updated
  },

  // ── ADVANCE CLAIM STATUS ─────────────────────────────────────
  // Enforces the strict status state machine.
  // On SETTLED → records repair cost as VehicleCost.
  // On THEFT → retires the vehicle.
  async advanceClaimStatus(claimId: string, dto: AdvanceClaimStatusDto, actorId: string) {
    const claim = await prisma.claim.findFirst({
      where:   { id: claimId, deletedAt: null },
      include: { vehicle: true, insurancePolicy: true },
    })
    if (!claim) throw new NotFoundError('Claim', claimId)

    // Validate transition
    const allowed = VALID_TRANSITIONS[claim.status] ?? []
    if (!allowed.includes(dto.status)) {
      throw new UnprocessableError(
        `Cannot transition claim from ${claim.status} to ${dto.status}. ` +
        `Allowed next statuses: ${allowed.join(', ') || 'none (terminal state)'}`
      )
    }

    const isClosing  = dto.status === 'CLOSED' || dto.status === 'SETTLED'
    const isSettled  = dto.status === 'SETTLED'
    const isRejected = dto.status === 'REJECTED'

    const result = await prisma.$transaction(async (tx) => {

      // 1. Advance claim status
      const updated = await tx.claim.update({
        where: { id: claimId },
        data: {
          status:        dto.status,
          managedById:   actorId,
          ...(dto.notes          ? { notes:          dto.notes }                                : {}),
          ...(isSettled && dto.settledAmount !== undefined
            ? { settledAmount:   new Decimal(dto.settledAmount.toString()) }
            : {}),
          ...(isSettled && dto.excessPaid !== undefined
            ? { excessPaid:      new Decimal(dto.excessPaid.toString()) }
            : {}),
          ...(isClosing  ? { closedAt: new Date() } : {}),
        },
      })

      // 2. On SETTLED → record repair cost on vehicle P&L
      let vehicleCost = null
      if (isSettled && dto.settledAmount && dto.settledAmount > 0) {
        vehicleCost = await tx.vehicleCost.create({
          data: {
            vehicleId:   claim.vehicleId,
            description: `Insurance claim settlement — ${claim.claimRef}`,
            amount:      new Decimal(dto.settledAmount.toString()),
            costDate:    new Date(),
            category:    'Repair',
            notes:       `Claim type: ${claim.type} | Policy: ${claim.insurancePolicy?.policyNumber ?? 'N/A'}`,
          },
        })

        // Also record excess as a separate cost if paid
        if (dto.excessPaid && dto.excessPaid > 0) {
          await tx.vehicleCost.create({
            data: {
              vehicleId:   claim.vehicleId,
              description: `Insurance excess — ${claim.claimRef}`,
              amount:      new Decimal(dto.excessPaid.toString()),
              costDate:    new Date(),
              category:    'Insurance',
              notes:       `Excess paid for claim ${claim.claimRef}`,
            },
          })
        }
      }

      // 3. On THEFT claim SETTLED → retire the vehicle (total loss)
      if (isSettled && claim.type === 'THEFT') {
        await tx.vehicle.update({
          where: { id: claim.vehicleId },
          data:  { status: 'RETIRED', isActive: false },
        })
      }

      // 4. On SETTLED (non-theft) → mark vehicle available if it was DAMAGED
      if (isSettled && claim.type !== 'THEFT' && claim.vehicle.status === 'DAMAGED') {
        await tx.vehicle.update({
          where: { id: claim.vehicleId },
          data:  { status: 'AVAILABLE' },
        })
      }

      return { updated, vehicleCost }
    })

    await auditService.log({
      userId:    actorId,
      action:    `CLAIM_${dto.status}`,
      entity:    'claims',
      entityId:  claimId,
      oldValues: { status: claim.status },
      newValues: {
        status:        dto.status,
        settledAmount: dto.settledAmount,
        excessPaid:    dto.excessPaid,
        notes:         dto.notes,
      },
    })

    return result.updated
  },

  // ── CLAIMS SUMMARY ───────────────────────────────────────────
  // Financial overview of all claims for the dashboard
  async getClaimsSummary(actorLocationId: string, isOwner: boolean) {
    const locationFilter = {
      vehicle: {
        deletedAt:  null,
        locationId: isOwner ? undefined : actorLocationId,
      },
    }

    const [byStatus, byType, financials, openCount] = await Promise.all([
      // Count by status
      prisma.claim.groupBy({
        by:    ['status'],
        where: { deletedAt: null, ...locationFilter },
        _count:{ id: true },
        _sum:  { estimatedCost: true, settledAmount: true },
      }),

      // Count by type
      prisma.claim.groupBy({
        by:    ['type'],
        where: { deletedAt: null, ...locationFilter },
        _count:{ id: true },
        _sum:  { settledAmount: true },
      }),

      // Total financial impact
      prisma.claim.aggregate({
        where: { deletedAt: null, status: 'SETTLED', ...locationFilter },
        _sum:  { settledAmount: true, excessPaid: true },
        _count:{ id: true },
      }),

      // Open + Under Review
      prisma.claim.count({
        where: {
          deletedAt: null,
          status:    { in: ['OPEN', 'UNDER_REVIEW'] },
          ...locationFilter,
        },
      }),
    ])

    return {
      openClaims: openCount,
      byStatus: byStatus.map((s) => ({
        status:        s.status,
        count:         s._count.id,
        estimatedCost: Number(s._sum.estimatedCost ?? 0),
        settledAmount: Number(s._sum.settledAmount  ?? 0),
      })),
      byType: byType.map((t) => ({
        type:          t.type,
        count:         t._count.id,
        settledAmount: Number(t._sum.settledAmount ?? 0),
      })),
      financials: {
        totalSettled:     financials._count.id,
        totalSettledCost: Number(financials._sum.settledAmount ?? 0),
        totalExcessPaid:  Number(financials._sum.excessPaid    ?? 0),
        netInsuranceCost: Number(financials._sum.settledAmount ?? 0) +
                          Number(financials._sum.excessPaid    ?? 0),
      },
    }
  },
}
