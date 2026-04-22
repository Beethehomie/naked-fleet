// ============================================================
// REPORTS MODULE — ROUTES
// All routes require authentication. FINANCE role included
// where read-only financial visibility is appropriate.
// ============================================================

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import {
  getOwnerDashboard,
  getRevenueReport,
  getDepositReport,
  getExpenseReport,
  getFleetReport,
  getBookingsReport,
  getTopCustomersReport,
} from './reports.controller'

const router = Router()
router.use(authenticate)

// ── OWNER DASHBOARD ───────────────────────────────────────────

/**
 * GET /api/v1/reports/dashboard
 * KPI snapshot for current period: revenue MoM, fleet utilisation,
 * deposit liability, compliance alerts, upcoming bookings.
 * OWNER sees all locations. MANAGER sees their location only.
 * FINANCE included for read access to financial health.
 */
router.get(
  '/dashboard',
  authorize('OWNER', 'MANAGER', 'FINANCE'),
  getOwnerDashboard
)

// ── FINANCIAL REPORTS ─────────────────────────────────────────

/**
 * GET /api/v1/reports/revenue
 * Revenue time series broken down by payment type.
 * Query: from, to, locationId, groupBy (day|week|month)
 * Includes: timeSeries[], byType[], summary { totalRevenue, totalCosts, margin }
 */
router.get(
  '/revenue',
  authorize('OWNER', 'MANAGER', 'FINANCE'),
  getRevenueReport
)

/**
 * GET /api/v1/reports/deposits
 * Deposit liability ledger — held vs resolved breakdown.
 * Query: from, to, locationId, status
 * Includes: summary { totalHeld, totalRefunded, totalDeducted, totalForfeited, netDepositRevenue }
 * FINANCE role intentionally included — key treasury metric.
 */
router.get(
  '/deposits',
  authorize('OWNER', 'MANAGER', 'FINANCE'),
  getDepositReport
)

/**
 * GET /api/v1/reports/expenses
 * Cost breakdown by category with percentage share.
 * Query: from, to, locationId
 * Includes: byCategory[], topCosts[], summary { totalExpenses, totalEntries }
 */
router.get(
  '/expenses',
  authorize('OWNER', 'MANAGER', 'FINANCE'),
  getExpenseReport
)

// ── FLEET REPORTS ─────────────────────────────────────────────

/**
 * GET /api/v1/reports/fleet
 * Per-vehicle P&L: revenue, costs, profit, utilisation rate.
 * Query: from, to, locationId, ownershipType, category, sortBy (revenue|profit|utilisation|costs)
 * Returns vehicles sorted by sortBy descending.
 */
router.get(
  '/fleet',
  authorize('OWNER', 'MANAGER', 'FINANCE'),
  getFleetReport
)

// ── BOOKINGS REPORTS ──────────────────────────────────────────

/**
 * GET /api/v1/reports/bookings
 * Volume trends, cancellation rate, avg booking duration, time series.
 * Query: from, to, locationId, groupBy (day|week|month), status
 * AGENT included — operational visibility for their own location.
 */
router.get(
  '/bookings',
  authorize('AGENT', 'MANAGER', 'OWNER', 'FINANCE'),
  getBookingsReport
)

// ── CUSTOMER REPORTS ──────────────────────────────────────────

/**
 * GET /api/v1/reports/customers/top
 * Top customers by total spend. Includes booking count, avg booking value.
 * Query: from, to, locationId
 */
router.get(
  '/customers/top',
  authorize('OWNER', 'MANAGER', 'FINANCE'),
  getTopCustomersReport
)

export { router as reportsRouter }
