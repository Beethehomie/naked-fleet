// ============================================================
// BOOKINGS MODULE — BOOKING SERVICE
//
// Owns the full booking lifecycle:
//   PENDING → CONFIRMED → ACTIVE → COMPLETED
//                       ↘ CANCELLED / NO_SHOW
//
// CRITICAL DESIGN RULES:
//   1. Rate + deposit amount are LOCKED at booking creation time
//      (copied from vehicle — not referenced live)
//   2. Vehicle availability is checked TWICE:
//      a. At booking creation (optimistic)
//      b. At vehicle allocation/confirmation (final atomic check)
//   3. A vehicle is only set to RESERVED after payment is confirmed
//      (see Phase 5 billing — CONFIRMED status triggers allocation)
//   4. All state transitions are logged to AuditLog
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
  CreateBookingDto,
  UpdateBookingDto,
  CancelBookingDto,
  ListBookingsQuery,
  AvailabilityQuery,
  CalendarQuery,
} from './bookings.schema'

// ── HELPERS ───────────────────────────────────────────────────

// Generates human-readable booking reference: BK-2024-00042
async function generateBookingRef(): Promise<string> {
  const year  = new Date().getFullYear()
  const count = await prisma.booking.count({
    where: { bookingRef: { startsWith: `BK-${year}-` } },
  })
  const seq = String(count + 1).padStart(5, '0')
  return `BK-${year}-${seq}`
}

// Calculates total days between two dates (inclusive of start day)
function calcTotalDays(start: Date, end: Date): number {
  const ms   = end.getTime() - start.getTime()
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  return Math.max(days, 1)
}

// ── AVAILABILITY CHECK ─────────────────────────────────────────
// Core query used in BOTH the availability endpoint and booking creation.
// Returns vehicle IDs that are BLOCKED for a given date range.
async function getBlockedVehicleIds(
  startDate:  Date,
  endDate:    Date,
  excludeBookingId?: string  // exclude current booking when updating
): Promise<Set<string>> {
  // A vehicle is blocked if there is any booking with a status that
  // "holds" the vehicle AND whose date range overlaps the query range.
  const blocked = await prisma.booking.findMany({
    where: {
      deletedAt: null,
      status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      // Date overlap: existing booking starts before query end
      //               AND existing booking ends after query start
      AND: [
        { startDate: { lt: endDate } },
        { endDate:   { gt: startDate } },
      ],
    },
    select: { vehicleId: true },
  })

  return new Set(blocked.map((b) => b.vehicleId))
}

// ── BOOKING SERVICE ────────────────────────────────────────────

export const bookingsService = {

  // ── CHECK VEHICLE AVAILABILITY ─────────────────────────────
  async checkAvailability(query: AvailabilityQuery) {
    const { startDate, endDate, locationId, category } = query

    const blockedIds = await getBlockedVehicleIds(startDate, endDate)

    const vehicles = await prisma.vehicle.findMany({
      where: {
        locationId,
        isActive:  true,
        deletedAt: null,
        status: { in: ['AVAILABLE', 'RESERVED'] }, // RESERVED may free up by query dates
        id:     { notIn: [...blockedIds] },
        ...(category ? { category } : {}),
      },
      select: {
        id:             true,
        registrationNo: true,
        make:           true,
        model:          true,
        year:           true,
        color:          true,
        category:       true,
        transmission:   true,
        fuelType:       true,
        seatingCapacity:true,
        dailyRate:      true,
        depositAmount:  true,
        ownershipType:  true,
        status:         true,
      },
      orderBy: { dailyRate: 'asc' },
    })

    const totalDays = calcTotalDays(startDate, endDate)

    return {
      availableVehicles: vehicles.map((v) => ({
        ...v,
        dailyRate:      Number(v.dailyRate),
        depositAmount:  Number(v.depositAmount),
        // Pre-calculate totals for UI display
        estimatedRental: Number(v.dailyRate) * totalDays,
        estimatedTotal:  Number(v.dailyRate) * totalDays + Number(v.depositAmount),
      })),
      totalDays,
      startDate,
      endDate,
      count: vehicles.length,
    }
  },

  // ── CREATE BOOKING ─────────────────────────────────────────
  async createBooking(dto: CreateBookingDto, actorId: string) {

    // 1. Validate customer
    const customer = await prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer', dto.customerId)
    if (customer.status === 'BLACKLISTED') {
      throw new ValidationError(
        `Customer is blacklisted and cannot make bookings. Reason: ${customer.blacklistReason ?? 'Not specified'}`
      )
    }
    if (customer.status !== 'ACTIVE') {
      throw new ValidationError('Customer account is not active')
    }

    // 2. Validate driver's licence
    if (!customer.driversLicence) {
      throw new ValidationError("Customer does not have a driver's licence on file")
    }
    if (customer.licenceExpiry && customer.licenceExpiry < new Date()) {
      throw new ValidationError(
        `Customer's driver's licence expired on ${customer.licenceExpiry.toDateString()}`
      )
    }

    // 3. Validate vehicle
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null, isActive: true },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', dto.vehicleId)
    if (vehicle.status === 'RETIRED') {
      throw new ValidationError('This vehicle has been retired and is no longer available')
    }
    if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'DAMAGED') {
      throw new ValidationError(`Vehicle is currently unavailable — status: ${vehicle.status}`)
    }

    // 4. Validate location
    const location = await prisma.location.findFirst({
      where: { id: dto.locationId, isActive: true, deletedAt: null },
    })
    if (!location) throw new NotFoundError('Location', dto.locationId)

    // 5. Check availability — prevent double booking
    const blockedIds = await getBlockedVehicleIds(dto.startDate, dto.endDate)
    if (blockedIds.has(dto.vehicleId)) {
      throw new ConflictError(
        `Vehicle ${vehicle.registrationNo} is not available for the selected dates. Please choose different dates or a different vehicle.`
      )
    }

    // 6. Lock financials at booking time (never reference live vehicle rates)
    const totalDays     = calcTotalDays(dto.startDate, dto.endDate)
    const dailyRate     = Number(vehicle.dailyRate)
    const depositAmount = Number(vehicle.depositAmount)
    const rentalAmount  = dailyRate * totalDays
    const totalAmount   = rentalAmount + depositAmount

    // 7. Generate unique booking reference
    const bookingRef = await generateBookingRef()

    // 8. Create booking record
    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        customerId:        dto.customerId,
        vehicleId:         dto.vehicleId,
        locationId:        dto.locationId,
        status:            'PENDING',
        startDate:         dto.startDate,
        endDate:           dto.endDate,
        totalDays,
        dailyRate:         new Decimal(dailyRate.toString()),
        rentalAmount:      new Decimal(rentalAmount.toString()),
        depositAmount:     new Decimal(depositAmount.toString()),
        totalAmount:       new Decimal(totalAmount.toString()),
        amountPaid:        new Decimal('0'),
        outstandingBalance: new Decimal(totalAmount.toString()),
        notes:             dto.notes ?? null,
        createdById:       actorId,
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        vehicle:  { select: { registrationNo: true, make: true, model: true, year: true, color: true } },
        location: { select: { name: true, city: true } },
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'BOOKING_CREATED',
      entity:    'bookings',
      entityId:  booking.id,
      newValues: {
        bookingRef,
        customerId:    dto.customerId,
        vehicleId:     dto.vehicleId,
        startDate:     dto.startDate,
        endDate:       dto.endDate,
        totalDays,
        rentalAmount,
        depositAmount,
        totalAmount,
      },
    })

    return booking
  },

  // ── GET BOOKING BY ID ──────────────────────────────────────
  async getBookingById(bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: {
        customer:   { select: { id: true, firstName: true, lastName: true, email: true, phone: true, driversLicence: true, licenceExpiry: true } },
        vehicle:    { select: { id: true, registrationNo: true, make: true, model: true, year: true, color: true, category: true, status: true } },
        location:   { select: { id: true, name: true, city: true } },
        createdBy:  { select: { firstName: true, lastName: true } },
        updatedBy:  { select: { firstName: true, lastName: true } },
        payments:   { where: { deletedAt: null }, orderBy: { paidAt: 'asc' } },
        deposit:    { include: { refunds: { where: { deletedAt: null } } } },
        contract:   { select: { id: true, contractRef: true, status: true, signedAt: true, documentUrl: true } },
        inspections: {
          where:   { deletedAt: null },
          orderBy: { conductedAt: 'asc' },
          include: { damageItems: true },
        },
      },
    })

    if (!booking) throw new NotFoundError('Booking', bookingId)
    return booking
  },

  // ── LIST BOOKINGS ──────────────────────────────────────────
  async listBookings(query: ListBookingsQuery, actorLocationId: string, isOwner: boolean) {
    const { status, customerId, vehicleId, locationId, from, to, page, limit } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(status     ? { status }     : {}),
      ...(customerId ? { customerId } : {}),
      ...(vehicleId  ? { vehicleId }  : {}),
      // Location: owners can filter or see all; others scoped to their location
      locationId: isOwner ? (locationId ?? undefined) : actorLocationId,
      ...(from || to
        ? { startDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}
      ),
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, email: true } },
          vehicle:  { select: { registrationNo: true, make: true, model: true } },
          location: { select: { name: true, city: true } },
          deposit:  { select: { status: true, amount: true } },
        },
      }),
      prisma.booking.count({ where }),
    ])

    return {
      data: bookings,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── UPDATE BOOKING ─────────────────────────────────────────
  // Only PENDING bookings can have dates changed
  async updateBooking(bookingId: string, dto: UpdateBookingDto, actorId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: { vehicle: true },
    })

    if (!booking) throw new NotFoundError('Booking', bookingId)
    if (booking.status !== 'PENDING') {
      throw new UnprocessableError(
        `Only PENDING bookings can be modified. This booking is ${booking.status}.`
      )
    }

    const newStart = dto.startDate ?? booking.startDate
    const newEnd   = dto.endDate   ?? booking.endDate

    // Re-check availability if dates changed
    if (dto.startDate || dto.endDate) {
      const blockedIds = await getBlockedVehicleIds(newStart, newEnd, bookingId)
      if (blockedIds.has(booking.vehicleId)) {
        throw new ConflictError(
          'Vehicle is not available for the updated dates. Please choose different dates.'
        )
      }
    }

    // Recalculate financials if dates changed
    const totalDays    = calcTotalDays(newStart, newEnd)
    const dailyRate    = Number(booking.dailyRate)
    const rentalAmount = dailyRate * totalDays
    const totalAmount  = rentalAmount + Number(booking.depositAmount)

    const oldValues = {
      startDate: booking.startDate,
      endDate:   booking.endDate,
      totalDays: booking.totalDays,
      rentalAmount: booking.rentalAmount,
      totalAmount:  booking.totalAmount,
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        startDate:         newStart,
        endDate:           newEnd,
        totalDays,
        rentalAmount:      new Decimal(rentalAmount.toString()),
        totalAmount:       new Decimal(totalAmount.toString()),
        outstandingBalance: new Decimal((totalAmount - Number(booking.amountPaid)).toString()),
        notes:             dto.notes ?? booking.notes,
        updatedById:       actorId,
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'BOOKING_UPDATED',
      entity:    'bookings',
      entityId:  bookingId,
      oldValues,
      newValues: { startDate: newStart, endDate: newEnd, totalDays, rentalAmount, totalAmount },
    })

    return updated
  },

  // ── CANCEL BOOKING ─────────────────────────────────────────
  async cancelBooking(bookingId: string, dto: CancelBookingDto, actorId: string) {
    const booking = await prisma.booking.findFirst({
      where:   { id: bookingId, deletedAt: null },
      include: { vehicle: true },
    })

    if (!booking) throw new NotFoundError('Booking', bookingId)
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new UnprocessableError(
        `Cannot cancel a booking with status: ${booking.status}. Only PENDING or CONFIRMED bookings can be cancelled.`
      )
    }

    await prisma.$transaction(async (tx) => {
      // Cancel the booking
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status:             'CANCELLED',
          cancellationReason: dto.reason,
          updatedById:        actorId,
        },
      })

      // Release the vehicle back to AVAILABLE
      if (booking.vehicle.status === 'RESERVED') {
        await tx.vehicle.update({
          where: { id: booking.vehicleId },
          data:  { status: 'AVAILABLE' },
        })
      }

      // If deposit was collected, mark it for refund processing
      // (Finance team handles actual refund via deposit.service.processDepositRefund)
      const deposit = await tx.deposit.findUnique({ where: { bookingId } })
      if (deposit && deposit.status === 'HELD') {
        await tx.deposit.update({
          where: { id: deposit.id },
          data:  { notes: 'Booking cancelled — pending refund review' },
        })
      }
    })

    await auditService.log({
      userId:    actorId,
      action:    'BOOKING_CANCELLED',
      entity:    'bookings',
      entityId:  bookingId,
      oldValues: { status: booking.status },
      newValues: { status: 'CANCELLED', reason: dto.reason },
    })

    return { success: true, message: 'Booking cancelled successfully' }
  },

  // ── CONFIRM BOOKING (VEHICLE ALLOCATION) ──────────────────
  // Called after full payment is received (triggered from billing service).
  // This is the ATOMIC vehicle reservation step.
  async confirmBookingAndAllocateVehicle(bookingId: string, actorId: string) {
    const booking = await prisma.booking.findFirst({
      where:   { id: bookingId, deletedAt: null },
      include: { vehicle: true },
    })

    if (!booking)                           throw new NotFoundError('Booking', bookingId)
    if (booking.status !== 'CONFIRMED')     throw new UnprocessableError('Booking must be CONFIRMED before vehicle allocation')
    if (Number(booking.outstandingBalance) > 0) {
      throw new ValidationError('Booking has an outstanding balance — cannot allocate vehicle')
    }

    // FINAL availability check — atomic guard against race conditions
    const blockedIds = await getBlockedVehicleIds(booking.startDate, booking.endDate, bookingId)
    if (blockedIds.has(booking.vehicleId)) {
      throw new ConflictError(
        'Vehicle is no longer available for the booking dates due to a conflicting reservation. Please contact the team to reassign a vehicle.'
      )
    }

    // Atomically reserve the vehicle
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: booking.vehicleId },
        data:  { status: 'RESERVED' },
      })
    })

    await auditService.log({
      userId:    actorId,
      action:    'VEHICLE_RESERVED',
      entity:    'vehicles',
      entityId:  booking.vehicleId,
      oldValues: { status: booking.vehicle.status },
      newValues: { status: 'RESERVED', bookingId, bookingRef: booking.bookingRef },
    })

    return { success: true, bookingId, vehicleId: booking.vehicleId }
  },

  // ── MARK AS NO-SHOW ────────────────────────────────────────
  async markNoShow(bookingId: string, actorId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
    })

    if (!booking) throw new NotFoundError('Booking', bookingId)
    if (booking.status !== 'CONFIRMED') {
      throw new UnprocessableError('Only CONFIRMED bookings can be marked as no-show')
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data:  { status: 'NO_SHOW', updatedById: actorId },
      })
      await tx.vehicle.update({
        where: { id: booking.vehicleId },
        data:  { status: 'AVAILABLE' },
      })
    })

    await auditService.log({
      userId:    actorId,
      action:    'BOOKING_NO_SHOW',
      entity:    'bookings',
      entityId:  bookingId,
      oldValues: { status: 'CONFIRMED' },
      newValues: { status: 'NO_SHOW' },
    })

    return { success: true }
  },

  // ── CALENDAR VIEW ──────────────────────────────────────────
  // Returns all bookings for a given month/year as calendar events.
  // Used to render the booking calendar on the dashboard.
  async getCalendarView(query: CalendarQuery, actorLocationId: string, isOwner: boolean) {
    const { locationId, month, year, vehicleId } = query

    // Build date range for the full month
    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth   = new Date(year, month, 0, 23, 59, 59)

    const effectiveLocationId = isOwner ? locationId : actorLocationId

    const bookings = await prisma.booking.findMany({
      where: {
        deletedAt:  null,
        locationId: effectiveLocationId,
        status:     { in: ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED'] },
        ...(vehicleId ? { vehicleId } : {}),
        // Booking overlaps with the month
        AND: [
          { startDate: { lte: endOfMonth } },
          { endDate:   { gte: startOfMonth } },
        ],
      },
      select: {
        id:         true,
        bookingRef: true,
        status:     true,
        startDate:  true,
        endDate:    true,
        totalDays:  true,
        customer:   { select: { firstName: true, lastName: true } },
        vehicle:    { select: { id: true, registrationNo: true, make: true, model: true, color: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    // Group by vehicle for a Gantt-style calendar view
    const byVehicle = bookings.reduce<Record<string, {
      vehicle: { id: string; registrationNo: string; make: string; model: string; color: string }
      bookings: typeof bookings
    }>>((acc, b) => {
      const vid = b.vehicle.id
      if (!acc[vid]) acc[vid] = { vehicle: b.vehicle, bookings: [] }
      acc[vid].bookings.push(b)
      return acc
    }, {})

    return {
      month,
      year,
      locationId: effectiveLocationId,
      startOfMonth,
      endOfMonth,
      totalBookings: bookings.length,
      byVehicle:     Object.values(byVehicle),
      bookings,       // flat list for list-view rendering
    }
  },

  // ── UPCOMING BOOKINGS ──────────────────────────────────────
  // Dashboard widget: bookings starting in the next N days
  async getUpcomingBookings(days = 7, actorLocationId: string, isOwner: boolean) {
    const now   = new Date()
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const bookings = await prisma.booking.findMany({
      where: {
        deletedAt:  null,
        status:     { in: ['CONFIRMED', 'PENDING'] },
        startDate:  { gte: now, lte: until },
        locationId: isOwner ? undefined : actorLocationId,
      },
      orderBy: { startDate: 'asc' },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        vehicle:  { select: { registrationNo: true, make: true, model: true } },
      },
    })

    return bookings
  },

  // ── OVERDUE BOOKINGS ───────────────────────────────────────
  // Bookings past their endDate but still ACTIVE (not checked in)
  async getOverdueBookings(actorLocationId: string, isOwner: boolean) {
    const now = new Date()

    const bookings = await prisma.booking.findMany({
      where: {
        deletedAt:  null,
        status:     'ACTIVE',
        endDate:    { lt: now },
        locationId: isOwner ? undefined : actorLocationId,
      },
      orderBy: { endDate: 'asc' },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        vehicle:  { select: { registrationNo: true, make: true, model: true } },
      },
    })

    return bookings.map((b) => ({
      ...b,
      daysOverdue: Math.floor((now.getTime() - b.endDate.getTime()) / (1000 * 60 * 60 * 24)),
    }))
  },
}
