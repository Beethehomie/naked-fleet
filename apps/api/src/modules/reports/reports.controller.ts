// ============================================================
// REPORTS MODULE — CONTROLLER
// Parse request → call service → respond. No logic here.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { reportsService } from './reports.service'
import {
  revenueReportQuerySchema,
  fleetReportQuerySchema,
  bookingsReportQuerySchema,
  depositReportQuerySchema,
  periodQuerySchema,
} from './reports.schema'

// ── OWNER DASHBOARD ───────────────────────────────────────────

/**
 * GET /api/v1/reports/dashboard
 * High-level KPI snapshot: revenue, bookings, fleet, deposits, compliance.
 */
export async function getOwnerDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reportsService.getOwnerDashboard(
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── FINANCIAL REPORTS ─────────────────────────────────────────

/**
 * GET /api/v1/reports/revenue
 * Revenue time series + breakdown by payment type + margin analysis.
 */
export async function getRevenueReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = revenueReportQuerySchema.parse(req.query)
    const result = await reportsService.getRevenueReport(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

/**
 * GET /api/v1/reports/deposits
 * Deposit liability ledger: held, refunded, deducted, forfeited.
 */
export async function getDepositReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = depositReportQuerySchema.parse(req.query)
    const result = await reportsService.getDepositReport(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

/**
 * GET /api/v1/reports/expenses
 * Cost breakdown by category with share percentages + top individual costs.
 */
export async function getExpenseReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = periodQuerySchema.parse(req.query)
    const result = await reportsService.getExpenseReport(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── FLEET & VEHICLE REPORTS ───────────────────────────────────

/**
 * GET /api/v1/reports/fleet
 * Per-vehicle P&L: revenue, costs, profit, utilisation. Sortable.
 */
export async function getFleetReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = fleetReportQuerySchema.parse(req.query)
    const result = await reportsService.getFleetReport(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── BOOKINGS REPORTS ──────────────────────────────────────────

/**
 * GET /api/v1/reports/bookings
 * Volume trends, cancellation rate, avg duration, time series.
 */
export async function getBookingsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = bookingsReportQuerySchema.parse(req.query)
    const result = await reportsService.getBookingsReport(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── CUSTOMER REPORTS ──────────────────────────────────────────

/**
 * GET /api/v1/reports/customers/top
 * Top customers ranked by total spend with avgBookingValue.
 */
export async function getTopCustomersReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = periodQuerySchema.parse(req.query)
    const result = await reportsService.getTopCustomersReport(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}
