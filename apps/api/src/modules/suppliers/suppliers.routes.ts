// ============================================================
// SUPPLIERS MODULE — ROUTES
// Supplier management is restricted to MANAGER and OWNER.
// Agents have no access to supplier data.
// ============================================================

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import {
  listSuppliers,
  createSupplier,
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
  getSupplierCostSummary,
  getExpiringContracts,
  listContracts,
  createContract,
  getContractById,
  updateContract,
  terminateContract,
  recordMonthlyFeePayment,
} from './suppliers.controller'

const router = Router()
router.use(authenticate)

// ── SUPPLIER OVERVIEW (before /:id routes) ────────────────────

/**
 * GET /api/v1/suppliers/cost-summary
 * Total monthly supplier fee commitments across all active contracts.
 * Grouped by supplier for the owner finance dashboard.
 */
router.get(
  '/cost-summary',
  authorize('FINANCE', 'OWNER'),
  getSupplierCostSummary
)

/**
 * GET /api/v1/suppliers/contracts/expiring
 * Contracts whose endDate is within the next N days (default: 30).
 * Query: days (optional)
 */
router.get(
  '/contracts/expiring',
  authorize('MANAGER', 'OWNER'),
  getExpiringContracts
)

// ── CONTRACTS (flat list, before /:id/contracts) ──────────────

/**
 * GET /api/v1/suppliers/contracts
 * List all supplier contracts with optional filters.
 * Query: supplierId, vehicleId, isActive, page, limit
 */
router.get(
  '/contracts',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  listContracts
)

/**
 * POST /api/v1/suppliers/contracts
 * Create a new supplier contract (links supplier to vehicle).
 */
router.post(
  '/contracts',
  authorize('OWNER'),
  createContract
)

/**
 * GET /api/v1/suppliers/contracts/:contractId
 * Single contract detail.
 */
router.get(
  '/contracts/:contractId',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  getContractById
)

/**
 * PUT /api/v1/suppliers/contracts/:contractId
 * Update contract terms, monthly fee, end date, or document URL.
 */
router.put(
  '/contracts/:contractId',
  authorize('OWNER'),
  updateContract
)

/**
 * POST /api/v1/suppliers/contracts/:contractId/terminate
 * Terminate an active contract. Sets isActive = false, endDate = today.
 * Resets vehicle ownershipType to OWNED if no other active contracts.
 */
router.post(
  '/contracts/:contractId/terminate',
  authorize('OWNER'),
  terminateContract
)

/**
 * POST /api/v1/suppliers/contracts/:contractId/record-fee
 * Manually record a monthly supplier fee as a VehicleCost.
 * Body: { forMonth?: Date }  (defaults to current month)
 * In production this is triggered automatically by the automation scheduler.
 */
router.post(
  '/contracts/:contractId/record-fee',
  authorize('FINANCE', 'OWNER'),
  recordMonthlyFeePayment
)

// ── SUPPLIERS CRUD ────────────────────────────────────────────

/**
 * GET /api/v1/suppliers
 * List all suppliers with optional status filter and search.
 */
router.get(
  '/',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  listSuppliers
)

/**
 * POST /api/v1/suppliers
 * Add a new supplier.
 */
router.post(
  '/',
  authorize('OWNER'),
  createSupplier
)

/**
 * GET /api/v1/suppliers/:id
 * Full supplier profile: vehicles, contracts, monthly commitment total.
 */
router.get(
  '/:id',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  getSupplierById
)

/**
 * PUT /api/v1/suppliers/:id
 * Update supplier contact details, banking info, notes.
 */
router.put(
  '/:id',
  authorize('OWNER'),
  updateSupplier
)

/**
 * POST /api/v1/suppliers/:id/deactivate
 * Deactivate a supplier and all their active contracts.
 * Fails if any supplier vehicles are currently rented.
 */
router.post(
  '/:id/deactivate',
  authorize('OWNER'),
  deactivateSupplier
)

export { router as suppliersRouter }
