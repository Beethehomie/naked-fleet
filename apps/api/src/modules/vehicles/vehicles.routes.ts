// ============================================================
// FLEET MODULE — ROUTES
// ============================================================

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import {
  listVehicles,
  createVehicle,
  getVehicleById,
  updateVehicle,
  updateVehicleStatus,
  deleteVehicle,
  addVehicleCost,
  listVehicleCosts,
  getVehiclePnl,
  getFleetOverview,
  getVehicleBookingHistory,
} from './vehicles.controller'

const router = Router()
router.use(authenticate)

// ── FLEET OVERVIEW (must be before /:id routes) ───────────────

/**
 * GET /api/v1/vehicles/overview
 * Fleet dashboard: status breakdown, utilisation rate, monthly P&L snapshot.
 */
router.get('/overview', authorize('MANAGER', 'FINANCE', 'OWNER'), getFleetOverview)

// ── VEHICLES ──────────────────────────────────────────────────

/**
 * GET /api/v1/vehicles
 * List all vehicles with filters (status, category, ownershipType, location).
 */
router.get('/', authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'), listVehicles)

/**
 * POST /api/v1/vehicles
 * Add a new vehicle to the fleet.
 */
router.post('/', authorize('MANAGER', 'OWNER'), createVehicle)

/**
 * GET /api/v1/vehicles/:id
 * Full vehicle detail including compliance, insurance, supplier contract.
 */
router.get('/:id', authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'), getVehicleById)

/**
 * PUT /api/v1/vehicles/:id
 * Update vehicle details (rate, category, notes, location, etc.)
 */
router.put('/:id', authorize('MANAGER', 'OWNER'), updateVehicle)

/**
 * DELETE /api/v1/vehicles/:id
 * Soft-delete (retire) a vehicle. Cannot retire RENTED or RESERVED vehicles.
 */
router.delete('/:id', authorize('OWNER'), deleteVehicle)

/**
 * PATCH /api/v1/vehicles/:id/status
 * Manually change vehicle status. RENTED/RESERVED are booking-controlled only.
 * Body: { status, reason }
 */
router.patch('/:id/status', authorize('MANAGER', 'OWNER'), updateVehicleStatus)

// ── COSTS ─────────────────────────────────────────────────────

/**
 * GET /api/v1/vehicles/:id/costs
 * List all cost records for a vehicle + category summary.
 * Query: from, to (optional date range)
 */
router.get('/:id/costs', authorize('MANAGER', 'FINANCE', 'OWNER'), listVehicleCosts)

/**
 * POST /api/v1/vehicles/:id/costs
 * Add a cost entry (maintenance, insurance, lease payment, etc.)
 */
router.post('/:id/costs', authorize('MANAGER', 'OWNER'), addVehicleCost)

// ── P&L + HISTORY ─────────────────────────────────────────────

/**
 * GET /api/v1/vehicles/:id/pnl
 * Full profitability report for a vehicle.
 * Revenue vs Costs → Gross Profit → ROI (if purchase price is set).
 * Query: from, to (optional date range)
 */
router.get('/:id/pnl', authorize('FINANCE', 'OWNER'), getVehiclePnl)

/**
 * GET /api/v1/vehicles/:id/bookings
 * Full booking history for a vehicle (paginated).
 */
router.get('/:id/bookings', authorize('MANAGER', 'FINANCE', 'OWNER'), getVehicleBookingHistory)

export { router as vehiclesRouter }
