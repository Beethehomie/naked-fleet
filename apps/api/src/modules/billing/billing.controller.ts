// ============================================================
// BILLING MODULE — CONTROLLER
// Only responsibility: parse request → call service → respond.
// Zero business logic lives here.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { billingService } from './billing.service'
import { depositService } from './deposit.service'
import { refundService } from './refund.service'
import {
  collectBookingPaymentSchema,
  createPaymentSchema,
  processRefundSchema,
  listDepositsQuerySchema,
  listPaymentsQuerySchema,
} from './billing.schema'

// ── PAYMENTS ─────────────────────────────────────────────────

export async function collectBookingPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = collectBookingPaymentSchema.parse(req.body)
    const result = await billingService.collectBookingPayment(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = createPaymentSchema.parse(req.body)
    const result = await billingService.createPayment(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function listPaymentsForBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const { bookingId } = req.params
    const result = await billingService.listPaymentsForBooking(bookingId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listPaymentsQuerySchema.parse(req.query)
    const result = await billingService.listPayments(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

export async function getBookingFinancialSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { bookingId } = req.params
    const result = await billingService.getBookingFinancialSummary(bookingId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ── DEPOSITS ─────────────────────────────────────────────────

export async function listDeposits(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listDepositsQuerySchema.parse(req.query)
    const result = await depositService.listDeposits(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

export async function getDepositById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const result = await depositService.getDepositById(id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getDepositByBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const { bookingId } = req.params
    const result = await depositService.getDepositByBooking(bookingId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function processDepositRefund(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = processRefundSchema.parse({ ...req.body, depositId: req.params.id })
    const result = await depositService.processDepositRefund(dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getDepositLiabilitySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await depositService.getDepositLiabilitySummary(
      req.query.locationId as string | undefined,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ── REFUNDS ──────────────────────────────────────────────────

export async function getRefundById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const result = await refundService.getRefundById(id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function listRefunds(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await refundService.listRefunds({
      page:       Number(req.query.page ?? 1),
      limit:      Number(req.query.limit ?? 20),
      status:     req.query.status as string | undefined,
      locationId: req.user.role === 'OWNER' ? req.query.locationId as string : req.user.locationId,
      isOwner:    req.user.role === 'OWNER',
    })
    return res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}
