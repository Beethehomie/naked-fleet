// ============================================================
// INSURANCE & CLAIMS MODULE — CONTROLLER
// Parse request → call service → respond. No logic here.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { claimsService } from './claims.service'
import {
  createInsurancePolicySchema,
  updateInsurancePolicySchema,
  openClaimSchema,
  updateClaimSchema,
  advanceClaimStatusSchema,
  listClaimsQuerySchema,
  listPoliciesQuerySchema,
} from './claims.schema'

// ── INSURANCE POLICIES ────────────────────────────────────────

export async function listPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listPoliciesQuerySchema.parse(req.query)
    const result = await claimsService.listPolicies(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}

export async function createInsurancePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = createInsurancePolicySchema.parse(req.body)
    const result = await claimsService.createInsurancePolicy(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getPolicyById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await claimsService.getPolicyById(req.params.policyId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function updatePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateInsurancePolicySchema.parse(req.body)
    const result = await claimsService.updatePolicy(req.params.policyId, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getExpiringPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const days   = Number(req.query.days ?? 30)
    const result = await claimsService.getExpiringPolicies(
      days,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result, count: result.length })
  } catch (err) { next(err) }
}

// ── CLAIMS ────────────────────────────────────────────────────

export async function listClaims(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listClaimsQuerySchema.parse(req.query)
    const result = await claimsService.listClaims(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}

export async function openClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = openClaimSchema.parse(req.body)
    const result = await claimsService.openClaim(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getClaimById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await claimsService.getClaimById(req.params.claimId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function updateClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateClaimSchema.parse(req.body)
    const result = await claimsService.updateClaim(req.params.claimId, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function advanceClaimStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = advanceClaimStatusSchema.parse(req.body)
    const result = await claimsService.advanceClaimStatus(req.params.claimId, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getClaimsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await claimsService.getClaimsSummary(
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}
