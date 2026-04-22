// ============================================================
// BILLING MODULE — ROUTES
// Applies auth + RBAC per endpoint.
// Controller handles all logic — this file is routing only.
// ============================================================

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import {
  collectBookingPayment,
  createPayment,
  listPayments,
  listPaymentsForBooking,
  getBookingFinancialSummary,
  listDeposits,
  getDepositById,
  getDepositByBooking,
  processDepositRefund,
  getDepositLiabilitySummary,
  getRefundById,
  listRefunds,
} from './billing.controller'

const router = Router()

// All billing routes require authentication
router.use(authenticate)

// ── PAYMENTS ─────────────────────────────────────────────────

/**
 * POST /api/v1/billing/collect
 * Collect rental fee + deposit for a booking in one call.
 * This is the primary payment endpoint — use for new bookings.
 */
router.post(
  '/collect',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  collectBookingPayment
)

/**
 * POST /api/v1/billing/payments
 * Record a single ad-hoc payment (extension fee, damage charge, etc.)
 */
router.post(
  '/payments',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  createPayment
)

/**
 * GET /api/v1/billing/payments
 * List all payments with optional filters (date range, type, booking)
 */
router.get(
  '/payments',
  authorize('FINANCE', 'MANAGER', 'OWNER'),
  listPayments
)

/**
 * GET /api/v1/billing/bookings/:bookingId/payments
 * All payments for a specific booking + financial summary
 */
router.get(
  '/bookings/:bookingId/payments',
  authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'),
  listPaymentsForBooking
)

/**
 * GET /api/v1/billing/bookings/:bookingId/summary
 * Full financial summary for a booking (revenue, deposit, outstanding)
 */
router.get(
  '/bookings/:bookingId/summary',
  authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'),
  getBookingFinancialSummary
)

// ── DEPOSITS ─────────────────────────────────────────────────

/**
 * GET /api/v1/billing/deposits
 * List all deposits with status filter — primary liability ledger view
 */
router.get(
  '/deposits',
  authorize('FINANCE', 'MANAGER', 'OWNER'),
  listDeposits
)

/**
 * GET /api/v1/billing/deposits/liability-summary
 * Dashboard widget: total held deposit liability + breakdown
 * Must be defined BEFORE /deposits/:id to avoid route conflict
 */
router.get(
  '/deposits/liability-summary',
  authorize('FINANCE', 'MANAGER', 'OWNER'),
  getDepositLiabilitySummary
)

/**
 * GET /api/v1/billing/deposits/:id
 * Single deposit record by deposit ID
 */
router.get(
  '/deposits/:id',
  authorize('FINANCE', 'MANAGER', 'OWNER'),
  getDepositById
)

/**
 * GET /api/v1/billing/bookings/:bookingId/deposit
 * Get deposit record for a specific booking
 */
router.get(
  '/bookings/:bookingId/deposit',
  authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'),
  getDepositByBooking
)

/**
 * POST /api/v1/billing/deposits/:id/refund
 * Process deposit refund decision after check-in inspection.
 * Managers and Finance can approve — Agents cannot.
 */
router.post(
  '/deposits/:id/refund',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  processDepositRefund
)

// ── REFUNDS ──────────────────────────────────────────────────

/**
 * GET /api/v1/billing/refunds
 * List all processed refunds
 */
router.get(
  '/refunds',
  authorize('FINANCE', 'MANAGER', 'OWNER'),
  listRefunds
)

/**
 * GET /api/v1/billing/refunds/:id
 * Single refund record by ID
 */
router.get(
  '/refunds/:id',
  authorize('FINANCE', 'MANAGER', 'OWNER'),
  getRefundById
)

export { router as billingRouter }
