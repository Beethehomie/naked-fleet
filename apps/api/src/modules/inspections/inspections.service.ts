// ============================================================
// INSPECTIONS MODULE — INSPECTIONS SERVICE
//
// Manages the two critical inspection events in every rental:
//   CHECK_OUT → vehicle leaves with documented condition
//   CHECK_IN  → vehicle returns, new damage assessed
//
// BUSINESS RULES:
//   1. Only ONE check-out inspection allowed per booking
//   2. Only ONE check-in inspection allowed per booking
//   3. Check-out MUST happen before check-in
//   4. All damage logged at CHECK_OUT is isPreExisting = true
//      (customer cannot be charged for this)
//   5. All damage logged at CHECK_IN is isPreExisting = false
//      (customer IS liable for this)
//   6. Check-out transitions: Booking → ACTIVE, Vehicle → RENTED
//   7. Check-in transitions:  Booking → COMPLETED, Vehicle → AVAILABLE (or DAMAGED)
//   8. Check-in triggers deposit decision readiness flag
//   9. Late return charges are calculated automatically at check-in
//  10. Mileage is updated on the vehicle record at both events
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
  CheckoutInspectionDto,
  CheckinInspectionDto,
  AddDamageItemDto,
  UpdateDamageItemDto,
  ListInspectionsQuery,
} from './inspections.schema'

export const inspectionsService = {

  // ── PERFORM CHECK-OUT INSPECTION ───────────────────────────
  // The vehicle is handed to the customer.
  // Booking → ACTIVE | Vehicle → RENTED | Damage logged as PRE-EXISTING
  async performCheckout(dto: CheckoutInspectionDto, actorId: string) {

    // 1. Load booking with all relations
    const booking = await prisma.booking.findFirst({
      where:   { id: dto.bookingId, deletedAt: null },
      include: {
        vehicle:  true,
        customer: { select: { id: true, driversLicence: true, licenceExpiry: true, status: true } },
        inspections: { where: { deletedAt: null } },
      },
    })

    if (!booking) throw new NotFoundError('Booking', dto.bookingId)

    // Guard: booking must be CONFIRMED
    if (booking.status !== 'CONFIRMED') {
      throw new UnprocessableError(
        `Booking must be CONFIRMED before check-out. Current status: ${booking.status}`
      )
    }

    // Guard: booking must be fully paid
    if (Number(booking.outstandingBalance) > 0) {
      throw new ValidationError(
        `Outstanding balance of ${Number(booking.outstandingBalance)} must be cleared before vehicle release`
      )
    }

    // Guard: no existing check-out inspection
    const existingCheckout = booking.inspections.find((i) => i.type === 'CHECK_OUT')
    if (existingCheckout) {
      throw new ConflictError(
        'A check-out inspection already exists for this booking'
      )
    }

    // Guard: customer licence
    if (!booking.customer.driversLicence) {
      throw new ValidationError("Customer does not have a driver's licence on file. Cannot release vehicle.")
    }
    if (
      booking.customer.licenceExpiry &&
      booking.customer.licenceExpiry < new Date()
    ) {
      throw new ValidationError(
        `Customer's driver's licence expired on ${booking.customer.licenceExpiry.toDateString()}. Cannot release vehicle.`
      )
    }

    // Guard: mileage cannot be less than vehicle's current recorded mileage
    if (dto.mileageAtTime < booking.vehicle.mileage) {
      throw new ValidationError(
        `Mileage at checkout (${dto.mileageAtTime}) cannot be less than current vehicle mileage (${booking.vehicle.mileage})`
      )
    }

    // 2. Atomic transaction: inspection + damage items + booking status + vehicle status
    const result = await prisma.$transaction(async (tx) => {

      // Create check-out inspection
      const inspection = await tx.inspection.create({
        data: {
          bookingId:         dto.bookingId,
          vehicleId:         booking.vehicleId,
          type:              'CHECK_OUT',
          mileageAtTime:     dto.mileageAtTime,
          fuelLevel:         dto.fuelLevel,
          conductedById:     actorId,
          conductedAt:       new Date(),
          hasDamage:         dto.damageItems.length > 0,
          notes:             dto.notes ?? null,
          customerSignature: dto.customerSignature ?? null,
        },
      })

      // Log pre-existing damage items
      if (dto.damageItems.length > 0) {
        await tx.damageItem.createMany({
          data: dto.damageItems.map((item) => ({
            inspectionId:  inspection.id,
            location:      item.location,
            description:   item.description,
            severity:      item.severity,
            estimatedCost: item.estimatedCost
                             ? new Decimal(item.estimatedCost.toString())
                             : null,
            photoUrl:      item.photoUrl ?? null,
            isPreExisting: true,   // ← ALWAYS true at checkout
          })),
        })
      }

      // Activate booking
      await tx.booking.update({
        where: { id: dto.bookingId },
        data: {
          status:          'ACTIVE',
          actualStartDate: new Date(),
          updatedById:     actorId,
        },
      })

      // Mark vehicle as RENTED + update mileage
      await tx.vehicle.update({
        where: { id: booking.vehicleId },
        data: {
          status:  'RENTED',
          mileage: dto.mileageAtTime,
        },
      })

      return inspection
    })

    // 3. Audit logs (outside transaction — non-critical if they fail)
    await Promise.all([
      auditService.log({
        userId:    actorId,
        action:    'INSPECTION_CHECKOUT_COMPLETED',
        entity:    'inspections',
        entityId:  result.id,
        newValues: {
          bookingId:    dto.bookingId,
          mileage:      dto.mileageAtTime,
          fuelLevel:    dto.fuelLevel,
          damageCount:  dto.damageItems.length,
          hasDamage:    dto.damageItems.length > 0,
        },
      }),
      auditService.log({
        userId:    actorId,
        action:    'BOOKING_ACTIVATED',
        entity:    'bookings',
        entityId:  dto.bookingId,
        oldValues: { status: 'CONFIRMED' },
        newValues: { status: 'ACTIVE', actualStartDate: new Date() },
      }),
      auditService.log({
        userId:    actorId,
        action:    'VEHICLE_STATUS_CHANGED',
        entity:    'vehicles',
        entityId:  booking.vehicleId,
        oldValues: { status: booking.vehicle.status },
        newValues: { status: 'RENTED', mileage: dto.mileageAtTime },
      }),
    ])

    // Load full inspection with damage items for response
    return prisma.inspection.findUniqueOrThrow({
      where:   { id: result.id },
      include: { damageItems: true },
    })
  },

  // ── PERFORM CHECK-IN INSPECTION ────────────────────────────
  // The vehicle is returned by the customer.
  // Booking → COMPLETED | Vehicle → AVAILABLE (or DAMAGED)
  // New damage → isPreExisting = false → customer is liable
  // Late return → extension fee calculated and flagged
  async performCheckin(dto: CheckinInspectionDto, actorId: string) {

    // 1. Load booking
    const booking = await prisma.booking.findFirst({
      where:   { id: dto.bookingId, deletedAt: null },
      include: {
        vehicle:     true,
        deposit:     true,
        inspections: {
          where:   { deletedAt: null },
          include: { damageItems: true },
        },
      },
    })

    if (!booking) throw new NotFoundError('Booking', dto.bookingId)

    // Guard: booking must be ACTIVE
    if (booking.status !== 'ACTIVE') {
      throw new UnprocessableError(
        `Only ACTIVE bookings can be checked in. Current status: ${booking.status}`
      )
    }

    // Guard: checkout must exist first
    const checkoutInspection = booking.inspections.find((i) => i.type === 'CHECK_OUT')
    if (!checkoutInspection) {
      throw new ValidationError('No check-out inspection found. Cannot perform check-in.')
    }

    // Guard: no duplicate check-in
    const existingCheckin = booking.inspections.find((i) => i.type === 'CHECK_IN')
    if (existingCheckin) {
      throw new ConflictError('A check-in inspection already exists for this booking')
    }

    // Guard: mileage at check-in cannot be less than mileage at checkout
    if (dto.mileageAtTime < checkoutInspection.mileageAtTime) {
      throw new ValidationError(
        `Check-in mileage (${dto.mileageAtTime}) cannot be less than check-out mileage (${checkoutInspection.mileageAtTime})`
      )
    }

    // 2. Calculate late return
    const now          = new Date()
    const isLate       = now > booking.endDate
    const lateDays     = isLate
      ? Math.ceil((now.getTime() - booking.endDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0
    const lateCharge   = isLate ? lateDays * Number(booking.dailyRate) : 0

    // 3. Determine new vehicle status
    const hasMajorDamage = dto.newDamageItems.some(
      (d) => d.severity === 'MAJOR' || d.severity === 'TOTALED'
    )
    const newVehicleStatus = hasMajorDamage ? 'DAMAGED' : 'AVAILABLE'

    // 4. Atomic transaction
    const result = await prisma.$transaction(async (tx) => {

      // Create check-in inspection
      const inspection = await tx.inspection.create({
        data: {
          bookingId:         dto.bookingId,
          vehicleId:         booking.vehicleId,
          type:              'CHECK_IN',
          mileageAtTime:     dto.mileageAtTime,
          fuelLevel:         dto.fuelLevel,
          conductedById:     actorId,
          conductedAt:       now,
          hasDamage:         dto.newDamageItems.length > 0,
          notes:             dto.notes ?? null,
          customerSignature: dto.customerSignature ?? null,
        },
      })

      // Log new damage items — these are chargeable
      if (dto.newDamageItems.length > 0) {
        await tx.damageItem.createMany({
          data: dto.newDamageItems.map((item) => ({
            inspectionId:  inspection.id,
            location:      item.location,
            description:   item.description,
            severity:      item.severity,
            estimatedCost: item.estimatedCost
                             ? new Decimal(item.estimatedCost.toString())
                             : null,
            photoUrl:      item.photoUrl ?? null,
            isPreExisting: false,   // ← ALWAYS false at checkin — customer liable
          })),
        })
      }

      // Complete booking
      await tx.booking.update({
        where: { id: dto.bookingId },
        data: {
          status:        'COMPLETED',
          actualEndDate: now,
          updatedById:   actorId,
        },
      })

      // Record late charge if applicable
      let latePayment = null
      if (lateCharge > 0) {
        latePayment = await tx.payment.create({
          data: {
            bookingId:     dto.bookingId,
            amount:        new Decimal(lateCharge.toString()),
            paymentType:   'EXTENSION_FEE',
            paymentMethod: 'CASH',          // default — agent updates if different
            status:        'PENDING',       // flagged for collection
            notes:         `Late return — ${lateDays} day(s) × ${Number(booking.dailyRate)}`,
            processedById: actorId,
            paidAt:        now,
          },
        })

        // Update outstanding balance
        await tx.booking.update({
          where: { id: dto.bookingId },
          data: {
            outstandingBalance: new Decimal(lateCharge.toString()),
            totalAmount: {
              increment: new Decimal(lateCharge.toString()),
            },
          },
        })
      }

      // Update vehicle status + mileage
      await tx.vehicle.update({
        where: { id: booking.vehicleId },
        data: {
          status:  newVehicleStatus,
          mileage: dto.mileageAtTime,
        },
      })

      return { inspection, latePayment }
    })

    // 5. Audit logs
    await Promise.all([
      auditService.log({
        userId:    actorId,
        action:    'INSPECTION_CHECKIN_COMPLETED',
        entity:    'inspections',
        entityId:  result.inspection.id,
        newValues: {
          bookingId:       dto.bookingId,
          mileage:         dto.mileageAtTime,
          fuelLevel:       dto.fuelLevel,
          newDamageCount:  dto.newDamageItems.length,
          hasDamage:       dto.newDamageItems.length > 0,
          isLate,
          lateDays,
          lateCharge,
        },
      }),
      auditService.log({
        userId:    actorId,
        action:    'BOOKING_COMPLETED',
        entity:    'bookings',
        entityId:  dto.bookingId,
        oldValues: { status: 'ACTIVE' },
        newValues: { status: 'COMPLETED', actualEndDate: now },
      }),
      auditService.log({
        userId:    actorId,
        action:    'VEHICLE_STATUS_CHANGED',
        entity:    'vehicles',
        entityId:  booking.vehicleId,
        oldValues: { status: 'RENTED' },
        newValues: { status: newVehicleStatus, mileage: dto.mileageAtTime },
      }),
    ])

    // 6. Load full inspection for response
    const fullInspection = await prisma.inspection.findUniqueOrThrow({
      where:   { id: result.inspection.id },
      include: { damageItems: true },
    })

    // 7. Build deposit decision recommendation
    const totalNewDamage = dto.newDamageItems.reduce(
      (sum, d) => sum + (d.estimatedCost ?? 0), 0
    )
    const depositAmount  = booking.deposit ? Number(booking.deposit.amount) : 0
    let depositDecision: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'FORFEIT'

    if (totalNewDamage === 0) {
      depositDecision = 'FULL_REFUND'
    } else if (totalNewDamage < depositAmount) {
      depositDecision = 'PARTIAL_REFUND'
    } else {
      depositDecision = 'FORFEIT'
    }

    return {
      inspection:     fullInspection,
      lateReturn: {
        isLate,
        lateDays,
        lateCharge,
        latePaymentId: result.latePayment?.id ?? null,
      },
      depositRecommendation: {
        decision:         depositDecision,
        totalNewDamage,
        depositAmount,
        suggestedRefund:  Math.max(depositAmount - totalNewDamage, 0),
        suggestedDeduction: Math.min(totalNewDamage, depositAmount),
        message: depositDecision === 'FULL_REFUND'
          ? 'No new damage found. Full deposit refund recommended.'
          : depositDecision === 'PARTIAL_REFUND'
          ? `New damage estimated at ${totalNewDamage}. Partial refund of ${Math.max(depositAmount - totalNewDamage, 0)} recommended.`
          : `Damage equals or exceeds deposit. Full deposit forfeiture recommended.`,
      },
    }
  },

  // ── GET INSPECTION BY ID ───────────────────────────────────
  async getInspectionById(inspectionId: string) {
    const inspection = await prisma.inspection.findFirst({
      where: { id: inspectionId, deletedAt: null },
      include: {
        damageItems:  { orderBy: { createdAt: 'asc' } },
        conductedBy:  { select: { firstName: true, lastName: true } },
        booking: {
          select: {
            bookingRef: true,
            status:     true,
            customer:   { select: { firstName: true, lastName: true } },
          },
        },
        vehicle: {
          select: { registrationNo: true, make: true, model: true, year: true },
        },
        documents: { where: { deletedAt: null } },
      },
    })

    if (!inspection) throw new NotFoundError('Inspection', inspectionId)
    return inspection
  },

  // ── GET INSPECTIONS FOR A BOOKING ─────────────────────────
  // Returns both CHECK_OUT and CHECK_IN side-by-side for comparison
  async getInspectionsForBooking(bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
    })
    if (!booking) throw new NotFoundError('Booking', bookingId)

    const inspections = await prisma.inspection.findMany({
      where:   { bookingId, deletedAt: null },
      orderBy: { conductedAt: 'asc' },
      include: {
        damageItems: { orderBy: { createdAt: 'asc' } },
        conductedBy: { select: { firstName: true, lastName: true } },
      },
    })

    const checkout = inspections.find((i) => i.type === 'CHECK_OUT') ?? null
    const checkin  = inspections.find((i) => i.type === 'CHECK_IN')  ?? null

    // Identify new damage (items that are NOT pre-existing at checkin)
    const newDamageItems = checkin?.damageItems.filter((d) => !d.isPreExisting) ?? []
    const totalNewDamage = newDamageItems.reduce(
      (sum, d) => sum + Number(d.estimatedCost ?? 0), 0
    )
    const mileageDriven = checkout && checkin
      ? checkin.mileageAtTime - checkout.mileageAtTime
      : null

    return {
      checkout,
      checkin,
      comparison: {
        mileageDriven,
        fuelDifference:  checkout && checkin
                           ? checkin.fuelLevel - checkout.fuelLevel
                           : null,
        newDamageItems,
        totalNewDamage,
        newDamageCount: newDamageItems.length,
      },
    }
  },

  // ── LIST INSPECTIONS ───────────────────────────────────────
  async listInspections(
    query:             ListInspectionsQuery,
    actorLocationId:   string,
    isOwner:           boolean
  ) {
    const { type, vehicleId, from, to, hasDamage, page, limit } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(type      ? { type }      : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(hasDamage !== undefined ? { hasDamage } : {}),
      ...(from || to
        ? { conductedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}
      ),
      booking: {
        deletedAt:  null,
        locationId: isOwner ? undefined : actorLocationId,
      },
    }

    const [inspections, total] = await Promise.all([
      prisma.inspection.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { conductedAt: 'desc' },
        include: {
          conductedBy: { select: { firstName: true, lastName: true } },
          vehicle:     { select: { registrationNo: true, make: true, model: true } },
          booking:     { select: { bookingRef: true, status: true, customer: { select: { firstName: true, lastName: true } } } },
          _count:      { select: { damageItems: true } },
        },
      }),
      prisma.inspection.count({ where }),
    ])

    return {
      data: inspections,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── ADD DAMAGE ITEM (post-inspection) ─────────────────────
  // Allows adding damage discovered after the inspection is submitted
  async addDamageItem(dto: AddDamageItemDto, actorId: string) {
    const inspection = await prisma.inspection.findFirst({
      where: { id: dto.inspectionId, deletedAt: null },
    })
    if (!inspection) throw new NotFoundError('Inspection', dto.inspectionId)

    const damageItem = await prisma.damageItem.create({
      data: {
        inspectionId:  dto.inspectionId,
        location:      dto.location,
        description:   dto.description,
        severity:      dto.severity,
        estimatedCost: dto.estimatedCost
                         ? new Decimal(dto.estimatedCost.toString())
                         : null,
        actualCost:    dto.actualCost
                         ? new Decimal(dto.actualCost.toString())
                         : null,
        photoUrl:      dto.photoUrl ?? null,
        isPreExisting: dto.isPreExisting,
      },
    })

    // Update inspection hasDamage flag
    await prisma.inspection.update({
      where: { id: dto.inspectionId },
      data:  { hasDamage: true },
    })

    await auditService.log({
      userId:    actorId,
      action:    'DAMAGE_ITEM_ADDED',
      entity:    'damage_items',
      entityId:  damageItem.id,
      newValues: {
        inspectionId:  dto.inspectionId,
        location:      dto.location,
        severity:      dto.severity,
        isPreExisting: dto.isPreExisting,
        estimatedCost: dto.estimatedCost,
      },
    })

    return damageItem
  },

  // ── UPDATE DAMAGE ITEM ────────────────────────────────────
  // Update cost actuals after repair quotes are confirmed
  async updateDamageItem(damageItemId: string, dto: UpdateDamageItemDto, actorId: string) {
    const item = await prisma.damageItem.findFirst({
      where: { id: damageItemId },
    })
    if (!item) throw new NotFoundError('Damage item', damageItemId)

    const updated = await prisma.damageItem.update({
      where: { id: damageItemId },
      data: {
        ...(dto.description   ? { description: dto.description }                               : {}),
        ...(dto.severity      ? { severity: dto.severity }                                     : {}),
        ...(dto.estimatedCost !== undefined
          ? { estimatedCost: dto.estimatedCost ? new Decimal(dto.estimatedCost.toString()) : null }
          : {}),
        ...(dto.actualCost !== undefined
          ? { actualCost: dto.actualCost ? new Decimal(dto.actualCost.toString()) : null }
          : {}),
        ...(dto.photoUrl      ? { photoUrl: dto.photoUrl }                                     : {}),
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'DAMAGE_ITEM_UPDATED',
      entity:    'damage_items',
      entityId:  damageItemId,
      oldValues: {
        estimatedCost: Number(item.estimatedCost ?? 0),
        actualCost:    Number(item.actualCost    ?? 0),
        severity:      item.severity,
      },
      newValues: dto,
    })

    return updated
  },

  // ── DAMAGE SUMMARY REPORT ─────────────────────────────────
  // Overview of all damage across the fleet in a period
  async getDamageSummary(locationId: string | undefined, isOwner: boolean, from?: Date, to?: Date) {
    const locationFilter = isOwner
      ? (locationId ? { vehicle: { locationId } } : {})
      : { vehicle: { locationId } }

    const [
      totalDamageItems,
      bySeverity,
      totalEstimated,
      openClaims,
    ] = await Promise.all([
      prisma.damageItem.count({
        where: {
          isPreExisting: false,
          inspection:    {
            deletedAt: null,
            type:      'CHECK_IN',
            ...locationFilter,
            ...(from || to
              ? { conductedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
              : {}
            ),
          },
        },
      }),
      prisma.damageItem.groupBy({
        by:    ['severity'],
        where: {
          isPreExisting: false,
          inspection:    { deletedAt: null, type: 'CHECK_IN', ...locationFilter },
        },
        _count: { id: true },
        _sum:   { estimatedCost: true },
      }),
      prisma.damageItem.aggregate({
        where: {
          isPreExisting: false,
          inspection:    { deletedAt: null, type: 'CHECK_IN', ...locationFilter },
        },
        _sum: { estimatedCost: true, actualCost: true },
      }),
      prisma.claim.count({
        where: {
          deletedAt: null,
          status:    { in: ['OPEN', 'UNDER_REVIEW'] },
          vehicle:   isOwner
            ? (locationId ? { locationId } : {})
            : { locationId },
        },
      }),
    ])

    return {
      period: { from: from ?? null, to: to ?? null },
      totals: {
        damageIncidents:    totalDamageItems,
        totalEstimatedCost: Number(totalEstimated._sum.estimatedCost ?? 0),
        totalActualCost:    Number(totalEstimated._sum.actualCost    ?? 0),
        openClaims,
      },
      bySeverity: bySeverity.map((s) => ({
        severity:      s.severity,
        count:         s._count.id,
        estimatedCost: Number(s._sum.estimatedCost ?? 0),
      })),
    }
  },
}
