// ============================================================
// INSPECTIONS MODULE — ROUTES
// ============================================================

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import {
  performCheckout,
  performCheckin,
  getInspectionById,
  getInspectionsForBooking,
  listInspections,
  addDamageItem,
  updateDamageItem,
  getDamageSummary,
} from './inspections.controller'

const router = Router()
router.use(authenticate)

// ── REPORTS (before /:id to avoid route conflicts) ────────────

/**
 * GET /api/v1/inspections/damage-summary
 * Fleet-wide damage summary: counts by severity, estimated costs, open claims.
 * Query: locationId, from, to (optional)
 */
router.get(
  '/damage-summary',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  getDamageSummary
)

// ── INSPECTION OPERATIONS ─────────────────────────────────────

/**
 * GET /api/v1/inspections
 * List inspections with filters (type, vehicle, date range, hasDamage).
 */
router.get(
  '/',
  authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'),
  listInspections
)

/**
 * POST /api/v1/inspections/checkout
 * Perform a check-out inspection.
 * Activates the booking and sets vehicle to RENTED.
 * Body: { bookingId, mileageAtTime, fuelLevel, damageItems[], notes, customerSignature }
 */
router.post(
  '/checkout',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  performCheckout
)

/**
 * POST /api/v1/inspections/checkin
 * Perform a check-in inspection.
 * Completes the booking, sets vehicle to AVAILABLE (or DAMAGED).
 * Returns deposit recommendation in response.
 * Body: { bookingId, mileageAtTime, fuelLevel, newDamageItems[], notes, customerSignature }
 */
router.post(
  '/checkin',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  performCheckin
)

/**
 * GET /api/v1/inspections/:id
 * Full inspection detail including damage items, vehicle, booking, conductor.
 */
router.get(
  '/:id',
  authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'),
  getInspectionById
)

// ── BOOKING-SCOPED INSPECTIONS ────────────────────────────────

/**
 * GET /api/v1/inspections/booking/:bookingId
 * Both CHECK_OUT and CHECK_IN inspections for a booking,
 * with side-by-side comparison (mileage driven, fuel diff, new damage).
 */
router.get(
  '/booking/:bookingId',
  authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'),
  getInspectionsForBooking
)

// ── DAMAGE ITEMS ──────────────────────────────────────────────

/**
 * POST /api/v1/inspections/:inspectionId/damage
 * Add a damage item to an existing inspection.
 * Can be used when damage is discovered after the inspection is submitted.
 */
router.post(
  '/:inspectionId/damage',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  addDamageItem
)

/**
 * PATCH /api/v1/inspections/damage/:damageItemId
 * Update a damage item — typically to set actualCost after repair.
 */
router.patch(
  '/damage/:damageItemId',
  authorize('MANAGER', 'OWNER'),
  updateDamageItem
)

export { router as inspectionsRouter }
