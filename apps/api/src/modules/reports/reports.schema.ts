// ============================================================
// REPORTS MODULE — ZOD VALIDATION SCHEMAS
// ============================================================

import { z } from 'zod'

// ── PERIOD QUERY (shared base) ────────────────────────────────
export const periodQuerySchema = z.object({
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  locationId: z.string().cuid().optional(),
})

export type PeriodQuery = z.infer<typeof periodQuerySchema>

// ── REVENUE REPORT QUERY ──────────────────────────────────────
export const revenueReportQuerySchema = periodQuerySchema.extend({
  groupBy: z.enum(['day', 'week', 'month']).default('month'),
})

export type RevenueReportQuery = z.infer<typeof revenueReportQuerySchema>

// ── FLEET REPORT QUERY ────────────────────────────────────────
export const fleetReportQuerySchema = periodQuerySchema.extend({
  locationId:    z.string().cuid().optional(),
  ownershipType: z.enum(['OWNED', 'LEASED', 'SUPPLIER']).optional(),
  category:      z.string().optional(),
  sortBy:        z.enum(['revenue', 'profit', 'utilisation', 'costs']).default('profit'),
})

export type FleetReportQuery = z.infer<typeof fleetReportQuerySchema>

// ── BOOKINGS REPORT QUERY ─────────────────────────────────────
export const bookingsReportQuerySchema = periodQuerySchema.extend({
  groupBy: z.enum(['day', 'week', 'month']).default('month'),
  status:  z.enum(['PENDING','CONFIRMED','ACTIVE','COMPLETED','CANCELLED','NO_SHOW']).optional(),
})

export type BookingsReportQuery = z.infer<typeof bookingsReportQuerySchema>

// ── DEPOSIT REPORT QUERY ──────────────────────────────────────
export const depositReportQuerySchema = periodQuerySchema.extend({
  status: z.enum(['HELD','REFUNDED','PARTIALLY_REFUNDED','FORFEITED','APPLIED']).optional(),
})

export type DepositReportQuery = z.infer<typeof depositReportQuerySchema>
