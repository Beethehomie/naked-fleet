// ============================================================
// BILLING MODULE — BILLING SERVICE
//
// Owns payment creation and booking-level financial tracking.
// Deposit creation is delegated to depositService.
//
// BUSINESS RULES ENFORCED HERE:
//   1. Deposit payment always creates a Deposit liability record
//   2. Booking financials (amountPaid, outstandingBalance) stay in sync
//   3. Booking status advances to CONFIRMED when fully paid
//   4. All financial moves are logged to AuditLog
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
import { depositService } from './deposit.service'
import type {
  CreatePaymentDto,
  CollectBookingPaymentDto,
  ListPaymentsQuery,
} from './billing.schema'

export const billingService = {

  // ── COLLECT FULL BOOKING PAYMENT ──────────────────────────
  // The primary entry point for collecting money against a booking.
  // Splits into rental fee + deposit in one atomic transaction.
  async collectBookingPayment(dto: CollectBookingPaymentDto, actorId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
    })

    if (!booking) throw new NotFoundError('Booking', dto.bookingId)

    // Guard: only collect on PENDING or CONFIRMED bookings
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new UnprocessableError(
        `Cannot collect payment for a booking with status: ${booking.status}`
      )
    }

    // Guard: already fully paid
    if (Number(booking.outstandingBalance) === 0) {
      throw new ConflictError('This booking is already fully paid.')
    }

    const rentalAmount  = Number(booking.rentalAmount)
    const depositAmount = Number(booking.depositAmount)

    const result = await prisma.$transaction(async (tx) => {

      // 1. Record rental fee payment
      const rentalPayment = await tx.payment.create({
        data: {
          bookingId:     booking.id,
          amount:        new Decimal(rentalAmount.toString()),
          paymentType:   'RENTAL_FEE',
          paymentMethod: dto.rentalFeeMethod,
          status:        'COMPLETED',
          reference:     dto.rentalReference ?? null,
          notes:         dto.notes ?? null,
          processedById: actorId,
          paidAt:        new Date(),
        },
      })

      // 2. Record deposit payment
      const depositPayment = await tx.payment.create({
        data: {
          bookingId:     booking.id,
          amount:        new Decimal(depositAmount.toString()),
          paymentType:   'DEPOSIT',
          paymentMethod: dto.depositMethod,
          status:        'COMPLETED',
          reference:     dto.depositReference ?? null,
          notes:         dto.notes ?? null,
          processedById: actorId,
          paidAt:        new Date(),
        },
      })

      // 3. Update booking financials
      const totalPaid        = rentalAmount + depositAmount
      const newAmountPaid    = Number(booking.amountPaid) + totalPaid
      const newOutstanding   = Number(booking.totalAmount) - newAmountPaid
      const isFullyPaid      = newOutstanding <= 0

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          amountPaid:        new Decimal(newAmountPaid.toString()),
          outstandingBalance: new Decimal(Math.max(newOutstanding, 0).toString()),
          status:            isFullyPaid ? 'CONFIRMED' : booking.status,
          updatedById:       actorId,
        },
      })

      return { rentalPayment, depositPayment, updatedBooking, isFullyPaid }
    })

    // 4. Create deposit LIABILITY record (outside transaction — has its own audit)
    const deposit = await depositService.createDeposit({
      bookingId: booking.id,
      amount:    depositAmount,
      actorId,
    })

    // 5. Audit log for each payment
    await Promise.all([
      auditService.log({
        userId:    actorId,
        action:    'PAYMENT_RECORDED',
        entity:    'payments',
        entityId:  result.rentalPayment.id,
        newValues: {
          type:   'RENTAL_FEE',
          amount: rentalAmount,
          method: dto.rentalFeeMethod,
        },
      }),
      auditService.log({
        userId:    actorId,
        action:    'PAYMENT_RECORDED',
        entity:    'payments',
        entityId:  result.depositPayment.id,
        newValues: {
          type:   'DEPOSIT',
          amount: depositAmount,
          method: dto.depositMethod,
        },
      }),
    ])

    if (result.isFullyPaid) {
      await auditService.log({
        userId:    actorId,
        action:    'BOOKING_CONFIRMED',
        entity:    'bookings',
        entityId:  booking.id,
        oldValues: { status: 'PENDING' },
        newValues: { status: 'CONFIRMED', amountPaid: result.updatedBooking.amountPaid },
      })
    }

    return {
      booking:        result.updatedBooking,
      rentalPayment:  result.rentalPayment,
      depositPayment: result.depositPayment,
      deposit,
      isFullyPaid:    result.isFullyPaid,
    }
  },

  // ── CREATE SINGLE PAYMENT ──────────────────────────────────
  // For ad-hoc payments: extensions, damage charges, partial top-ups
  async createPayment(dto: CreatePaymentDto, actorId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
    })

    if (!booking) throw new NotFoundError('Booking', dto.bookingId)

    // Deposit type must go through collectBookingPayment instead
    if (dto.paymentType === 'DEPOSIT') {
      throw new ValidationError(
        'Deposit payments must be collected through the full booking payment flow.'
      )
    }

    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          bookingId:     booking.id,
          amount:        new Decimal(dto.amount.toString()),
          paymentType:   dto.paymentType,
          paymentMethod: dto.paymentMethod,
          status:        'COMPLETED',
          reference:     dto.reference ?? null,
          notes:         dto.notes ?? null,
          processedById: actorId,
          paidAt:        dto.paidAt ?? new Date(),
        },
      })

      // Update booking balance for any additional charges
      if (['EXTENSION_FEE', 'DAMAGE_CHARGE', 'OTHER'].includes(dto.paymentType)) {
        const newAmountPaid  = Number(booking.amountPaid) + dto.amount
        const newOutstanding = Number(booking.outstandingBalance) - dto.amount

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            amountPaid:         new Decimal(newAmountPaid.toString()),
            outstandingBalance: new Decimal(Math.max(newOutstanding, 0).toString()),
            updatedById:        actorId,
          },
        })
      }

      return newPayment
    })

    await auditService.log({
      userId:    actorId,
      action:    'PAYMENT_RECORDED',
      entity:    'payments',
      entityId:  payment.id,
      newValues: {
        type:      dto.paymentType,
        amount:    dto.amount,
        method:    dto.paymentMethod,
        bookingId: dto.bookingId,
      },
    })

    return payment
  },

  // ── LIST PAYMENTS FOR A BOOKING ────────────────────────────
  async listPaymentsForBooking(bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
    })
    if (!booking) throw new NotFoundError('Booking', bookingId)

    const payments = await prisma.payment.findMany({
      where:   { bookingId, deletedAt: null },
      orderBy: { paidAt: 'asc' },
      include: {
        processedBy: { select: { firstName: true, lastName: true } },
        refund:      { select: { amount: true, status: true, refundMethod: true } },
      },
    })

    // Financial summary for the booking
    const summary = payments.reduce(
      (acc, p) => {
        if (p.paymentType === 'RENTAL_FEE')    acc.rentalFeeTotal    += Number(p.amount)
        if (p.paymentType === 'DEPOSIT')        acc.depositTotal      += Number(p.amount)
        if (p.paymentType === 'DAMAGE_CHARGE')  acc.damageChargeTotal += Number(p.amount)
        if (p.paymentType === 'EXTENSION_FEE')  acc.extensionFeeTotal += Number(p.amount)
        return acc
      },
      { rentalFeeTotal: 0, depositTotal: 0, damageChargeTotal: 0, extensionFeeTotal: 0 }
    )

    return { payments, summary }
  },

  // ── LIST ALL PAYMENTS ──────────────────────────────────────
  async listPayments(query: ListPaymentsQuery, actorLocationId: string, isOwner: boolean) {
    const { bookingId, paymentType, from, to, page = 1, limit = 20 } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(bookingId    ? { bookingId }    : {}),
      ...(paymentType  ? { paymentType }  : {}),
      ...(from || to
        ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}
      ),
      booking: {
        deletedAt:  null,
        locationId: isOwner ? undefined : actorLocationId,
      },
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paidAt: 'desc' },
        include: {
          booking: {
            select: {
              bookingRef: true,
              customer:   { select: { firstName: true, lastName: true } },
            },
          },
          processedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.payment.count({ where }),
    ])

    return {
      data: payments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── BOOKING FINANCIAL SUMMARY ──────────────────────────────
  // Full financial picture for a single booking
  async getBookingFinancialSummary(bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: {
        payments: {
          where:   { deletedAt: null },
          orderBy: { paidAt: 'asc' },
        },
        deposit: {
          include: {
            refunds: { where: { deletedAt: null } },
          },
        },
      },
    })

    if (!booking) throw new NotFoundError('Booking', bookingId)

    const totalRevenue = booking.payments
      .filter((p) => ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE', 'OTHER'].includes(p.paymentType))
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const depositHeld = booking.deposit?.status === 'HELD'
      ? Number(booking.deposit.amount)
      : 0

    const totalRefunded = (booking.deposit?.refunds ?? [])
      .filter((r) => r.status === 'PROCESSED')
      .reduce((sum, r) => sum + Number(r.amount), 0)

    return {
      bookingRef:        booking.bookingRef,
      rentalAmount:      Number(booking.rentalAmount),
      depositAmount:     Number(booking.depositAmount),
      totalAmount:       Number(booking.totalAmount),
      amountPaid:        Number(booking.amountPaid),
      outstandingBalance: Number(booking.outstandingBalance),
      // Financial breakdown
      revenueRecognised: totalRevenue,
      depositLiability:  depositHeld,
      totalRefunded,
      depositStatus:     booking.deposit?.status ?? null,
      payments:          booking.payments,
    }
  },
}
