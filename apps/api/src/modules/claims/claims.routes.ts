// ============================================================
// INSURANCE & CLAIMS MODULE — ROUTES
// ============================================================

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import {
  listPolicies,
  createInsurancePolicy,
  getPolicyById,
  updatePolicy,
  getExpiringPolicies,
  listClaims,
  openClaim,
  getClaimById,
  updateClaim,
  advanceClaimStatus,
  getClaimsSummary,
} from './claims.controller'

const router = Router()
router.use(authenticate)

// ── INSURANCE POLICIES ────────────────────────────────────────

/**
 * GET /api/v1/claims/policies/expiring
 * Policies expiring within N days (default: 30).
 * Feeds into the compliance alert system.
 * Query: days (optional)
 */
router.get(
  '/policies/expiring',
  authorize('MANAGER', 'OWNER'),
  getExpiringPolicies
)

/**
 * GET /api/v1/claims/policies
 * List all insurance policies with vehicle + claims count.
 * Query: vehicleId, isActive, page, limit
 */
router.get(
  '/policies',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  listPolicies
)

/**
 * POST /api/v1/claims/policies
 * Add an insurance policy to a vehicle.
 * Automatically deactivates existing active policy for same vehicle.
 */
router.post(
  '/policies',
  authorize('MANAGER', 'OWNER'),
  createInsurancePolicy
)

/**
 * GET /api/v1/claims/policies/:policyId
 * Full policy detail including all claims raised against it.
 */
router.get(
  '/policies/:policyId',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  getPolicyById
)

/**
 * PUT /api/v1/claims/policies/:policyId
 * Update policy details (renewal, premium change, document upload).
 */
router.put(
  '/policies/:policyId',
  authorize('MANAGER', 'OWNER'),
  updatePolicy
)

// ── CLAIMS ────────────────────────────────────────────────────

/**
 * GET /api/v1/claims/summary
 * Dashboard: claim counts by status + type, total financial impact.
 */
router.get(
  '/summary',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  getClaimsSummary
)

/**
 * GET /api/v1/claims
 * List all claims with filters (status, type, vehicle, date range).
 */
router.get(
  '/',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  listClaims
)

/**
 * POST /api/v1/claims
 * Open a new claim against a vehicle.
 * Body: { vehicleId, type, description, incidentDate, bookingId?, insurancePolicyId? }
 */
router.post(
  '/',
  authorize('MANAGER', 'OWNER'),
  openClaim
)

/**
 * GET /api/v1/claims/:claimId
 * Full claim detail: vehicle, booking, policy, damage items, documents.
 */
router.get(
  '/:claimId',
  authorize('MANAGER', 'FINANCE', 'OWNER'),
  getClaimById
)

/**
 * PUT /api/v1/claims/:claimId
 * Update claim details (description, location, estimated cost, policy linkage).
 * Not allowed on CLOSED claims.
 */
router.put(
  '/:claimId',
  authorize('MANAGER', 'OWNER'),
  updateClaim
)

/**
 * POST /api/v1/claims/:claimId/status
 * Advance claim through its lifecycle:
 *   OPEN → UNDER_REVIEW → APPROVED → SETTLED → CLOSED
 *   OPEN → CLOSED (withdrawn)
 *   UNDER_REVIEW → REJECTED → CLOSED
 *
 * On SETTLED: records VehicleCost for repair + excess.
 *             THEFT claims also retire the vehicle.
 *
 * Body: { status, settledAmount?, excessPaid?, notes? }
 */
router.post(
  '/:claimId/status',
  authorize('MANAGER', 'OWNER'),
  advanceClaimStatus
)

export { router as claimsRouter }
