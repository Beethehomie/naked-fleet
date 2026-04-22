// ============================================================
// BILLING MODULE — DEPOSIT SERVICE
//
// The deposit is a LIABILITY — not revenue.
// It is created when a deposit payment is collected,
// and resolved (refunded/forfeited) after check-in inspection.
//
// This service owns all deposit lifecycle transitions.
// ============================================================

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../../config/database'
import { auditService } from '../../shared/audit.service'
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../shared/errors'
import type { ProcessRefundDto, ListDepositsQuery } from './billing.schema'
import { refundService } from './refund.service'

export const depositService = {

  // ── CREATE DEPOSIT ─────────────────────────────────────────
  // Called internally after a DEPOSIT payment is confirmed.
  // Never called directly from the controller.
  async createDeposit({
    bookingId,
    amount,
    actorId,
  }: {
    bookingId: string
    amount:    number | Decimal
    actorId:   string
  }) {
    // Guard: one deposit per booking (enforced in DB too, double check here)
    const existing = await prisma.deposit.findUnique({ where: { bookingId } })
    if (existing) {
      throw new ConflictError(`A deposit already exists for booking ${bookingId}`)
    }

    const deposit = await prisma.deposit.create({
      data: {
        bookingId,
        amount:    new Decimal(amount.toString()),
        status:    'HELD',
        heldAt:    new Date(),
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'DEPOSIT_HELD',
      entity:    'deposits',
      entityId:  deposit.id,
      newValues: { bookingId, amount: deposit.amount.toString(), status: 'HELD' },
    })

    return deposit
  },

  // ── GET DEPOSIT BY BOOKING ─────────────────────────────────
  async getDepositByBooking(bookingId: string) {
    const deposit = await prisma.deposit.findUnique({
      where: { bookingId },
      include: {
        booking: {
          select: {
            bookingRef:    true,
            customer:      { select: { firstName: true, lastName: true, email: true } },
            vehicle:       { select: { registrationNo: true, make: true, model: true } },
          },
        },
        refunds: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!deposit) throw new NotFoundError('Deposit', bookingId)
    return deposit
  },

  // ── GET DEPOSIT BY ID ──────────────────────────────────────
  async getDepositById(depositId: string) {
    const deposit = await prisma.deposit.findFirst({
      where: { id: depositId, deletedAt: null },
      include: {
        booking: {
          select: {
            bookingRef: true,
            customer:   { select: { firstName: true, lastName: true, email: true } },
            vehicle:    { select: { registrationNo: true, make: true, model: true } },
          },
        },
        refunds: {
          where: { deletedAt: null },
        },
      },
    })

    if (!deposit) throw new NotFoundError('Deposit', depositId)
    return deposit
  },

  // ── LIST DEPOSITS ──────────────────────────────────────────
  async listDeposits(query: ListDepositsQuery, actorLocationId: string, isOwner: boolean) {
    const { status, locationId, page, limit, from, to } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt:  null,
      ...(status ? { status } : {}),
      ...(from || to
        ? { heldAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}
      ),
      booking: {
        deletedAt: null,
        // Non-owners are scoped to their location
        locationId: isOwner
          ? (locationId ?? undefined)
          : actorLocationId,
      },
    }

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { heldAt: 'desc' },
        include: {
          booking: {
            select: {
              bookingRef: true,
              locationId: true,
              customer:   { select: { firstName: true, lastName: true } },
              vehicle:    { select: { registrationNo: true, make: true, model: true } },
            },
          },
          refunds: { where: { deletedAt: null }, select: { amount: true, status: true } },
        },
      }),
      prisma.deposit.count({ where }),
    ])

    return {
      data: deposits,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  },

  // ── PROCESS REFUND (DEPOSIT DECISION) ─────────────────────
  // The critical business operation: what happens to the deposit
  // after the check-in inspection is complete.
  //
  // Three outcomes:
  //   1. Full refund     → deductionAmount = 0
  //   2. Partial refund  → 0 < deductionAmount < deposit.amount
  //   3. Full forfeiture → deductionAmount >= deposit.amount
  //
  async processDepositRefund(dto: ProcessRefundDto, actorId: string) {
    const deposit = await prisma.deposit.findFirst({
      where:   { id: dto.depositId, deletedAt: null },
      include: {
        booking: {
          select: {
            id:         true,
            bookingRef: true,
            status:     true,
          },
        },
      },
    })

    if (!deposit) throw new NotFoundError('Deposit', dto.depositId)

    // Guard: deposit must be in HELD status
    if (deposit.status !== 'HELD') {
      throw new ConflictError(
        `Deposit is already resolved with status: ${deposit.status}. Cannot process again.`
      )
    }

    // Guard: booking must be COMPLETED before deposit can be released
    if (deposit.booking.status !== 'COMPLETED') {
      throw new ValidationError(
        `Booking must be COMPLETED before releasing the deposit. Current status: ${deposit.booking.status}`
      )
    }

    const depositAmount    = Number(deposit.amount)
    const deductionAmount  = dto.deductionAmount ?? 0

    // Guard: cannot deduct more than the deposit
    if (deductionAmount > depositAmount) {
      throw new ValidationError(
        `Deduction amount (${deductionAmount}) cannot exceed deposit amount (${depositAmount})`
      )
    }

    const refundAmount = depositAmount - deductionAmount

    // Determine deposit outcome
    let newDepositStatus: 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'FORFEITED'

    if (deductionAmount === 0) {
      newDepositStatus = 'REFUNDED'
    } else if (refundAmount > 0) {
      newDepositStatus = 'PARTIALLY_REFUNDED'
    } else {
      newDepositStatus = 'FORFEITED'
    }

    // All writes in a transaction — atomicity guaranteed
    const result = await prisma.$transaction(async (tx) => {

      // 1. Update deposit status
      const updatedDeposit = await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status:     newDepositStatus,
          releasedAt: new Date(),
          notes:      dto.reason ?? null,
        },
      })

      // 2. Create refund record (even for forfeitures — refund amount = 0)
      const refund = await tx.refund.create({
        data: {
          depositId:       deposit.id,
          amount:          new Decimal(refundAmount.toString()),
          deductionAmount: new Decimal(deductionAmount.toString()),
          deductionReason: dto.deductionReason ?? null,
          status:          'PENDING',
          refundMethod:    dto.refundMethod,
          reference:       dto.reference ?? null,
          reason:          dto.reason ?? null,
          processedById:   actorId,
        },
      })

      // 3. If deduction > 0, record it as DAMAGE_CHARGE payment (revenue)
      if (deductionAmount > 0) {
        await tx.payment.create({
          data: {
            bookingId:     deposit.booking.id,
            amount:        new Decimal(deductionAmount.toString()),
            paymentType:   'DAMAGE_CHARGE',
            paymentMethod: dto.refundMethod,
            status:        'COMPLETED',
            notes:         dto.deductionReason ?? 'Deducted from deposit',
            processedById: actorId,
            paidAt:        new Date(),
          },
        })
      }

      return { deposit: updatedDeposit, refund }
    })

    // 4. Mark refund as processed (in real system, this triggers payment gateway / manual confirmation)
    await prisma.refund.update({
      where: { id: result.refund.id },
      data:  { status: 'PROCESSED', processedAt: new Date() },
    })

    // 5. Audit log
    await auditService.log({
      userId:    actorId,
      action:    `DEPOSIT_${newDepositStatus}`,
      entity:    'deposits',
      entityId:  deposit.id,
      oldValues: { status: 'HELD', amount: depositAmount },
      newValues: {
        status:          newDepositStatus,
        refundAmount,
        deductionAmount,
        deductionReason: dto.deductionReason,
      },
    })

    return {
      deposit:         result.deposit,
      refund:          result.refund,
      outcome:         newDepositStatus,
      refundAmount,
      deductionAmount,
    }
  },

  // ── DEPOSIT LIABILITY SUMMARY ──────────────────────────────
  // For the financial dashboard — total outstanding deposit liability
  async getDepositLiabilitySummary(locationId?: string, isOwner?: boolean) {
    const locationFilter = isOwner
      ? (locationId ? { booking: { locationId } } : {})
      : { booking: { locationId } }

    const [held, stats] = await Promise.all([
      // Total HELD (liability on balance sheet)
      prisma.deposit.aggregate({
        where:  { status: 'HELD', deletedAt: null, ...locationFilter },
        _sum:   { amount: true },
        _count: { id: true },
      }),
      // Breakdown by status
      prisma.deposit.groupBy({
        by:     ['status'],
        where:  { deletedAt: null, ...locationFilter },
        _sum:   { amount: true },
        _count: { id: true },
      }),
    ])

    return {
      totalHeld:      Number(held._sum.amount ?? 0),
      countHeld:      held._count.id,
      breakdown:      stats.map((s) => ({
        status:       s.status,
        totalAmount:  Number(s._sum.amount ?? 0),
        count:        s._count.id,
      })),
    }
  },
}
