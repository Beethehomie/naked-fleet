// ============================================================
// COMPLIANCE MODULE — ROUTES
// ============================================================

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import {
  getComplianceDashboard,
  getExpiringSoon,
  refreshAllStatuses,
  getVehicleCompliance,
  getCustomerCompliance,
  listComplianceItems,
  createComplianceItem,
  getComplianceItemById,
  updateComplianceItem,
  deleteComplianceItem,
} from './compliance.controller'

const router = Router()
router.use(authenticate)

// ── DASHBOARD & AGGREGATE VIEWS ───────────────────────────────

/**
 * GET /api/v1/compliance/dashboard
 * High-level compliance health: counts by status, type, entity.
 * Compliance rate = valid / total items.
 */
router.get(
  '/dashboard',
  authorize('MANAGER', 'OWNER'),
  getComplianceDashboard
)

/**
 * GET /api/v1/compliance/expiring
 * All items expiring within N days (default 30), sorted soonest first.
 * Query: withinDays, entityType, type, locationId
 * Used by automation layer to generate alerts (Phase 13).
 */
router.get(
  '/expiring',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  getExpiringSoon
)

/**
 * POST /api/v1/compliance/refresh
 * Bulk recalculates stored status for ALL compliance items.
 * Normally called by the daily automation scheduler.
 * Can be triggered manually by OWNER for an immediate refresh.
 * Query: thresholdDays (default: 30)
 */
router.post(
  '/refresh',
  authorize('OWNER'),
  refreshAllStatuses
)

// ── ENTITY-SCOPED VIEWS ───────────────────────────────────────

/**
 * GET /api/v1/compliance/vehicles/:vehicleId
 * Full compliance profile for a vehicle.
 * Includes gap detection for required items (VEHICLE_LICENCE, ROADWORTHY, INSURANCE).
 * Returns isBookable flag — used by booking service pre-check.
 */
router.get(
  '/vehicles/:vehicleId',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  getVehicleCompliance
)

/**
 * GET /api/v1/compliance/customers/:customerId
 * Full compliance profile for a customer.
 * Checks both ComplianceItems and the denormalised licence fields.
 * Returns canRent flag.
 */
router.get(
  '/customers/:customerId',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  getCustomerCompliance
)

// ── COMPLIANCE ITEMS CRUD ─────────────────────────────────────

/**
 * GET /api/v1/compliance
 * List compliance items with filters.
 * Query: type, status, entityType, vehicleId, customerId, page, limit
 */
router.get(
  '/',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  listComplianceItems
)

/**
 * POST /api/v1/compliance
 * Create a new compliance item for a vehicle, customer, or company.
 * Prevents duplicate active items of the same type.
 * Status derived automatically from expiryDate.
 */
router.post(
  '/',
  authorize('MANAGER', 'OWNER'),
  createComplianceItem
)

/**
 * GET /api/v1/compliance/:id
 * Single compliance item with computed status + daysToExpiry.
 */
router.get(
  '/:id',
  authorize('AGENT', 'MANAGER', 'OWNER'),
  getComplianceItemById
)

/**
 * PUT /api/v1/compliance/:id
 * Update compliance item (renewal — new expiry date, reference number, document).
 * Status is automatically recalculated on update.
 */
router.put(
  '/:id',
  authorize('MANAGER', 'OWNER'),
  updateComplianceItem
)

/**
 * DELETE /api/v1/compliance/:id
 * Soft-delete a compliance item (marks deletedAt).
 * History is preserved — record is not physically removed.
 */
router.delete(
  '/:id',
  authorize('OWNER'),
  deleteComplianceItem
)

export { router as complianceRouter }
