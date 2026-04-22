// ============================================================
// COMPLIANCE MODULE — CONTROLLER
// Parse request → call service → respond. No logic here.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { complianceService } from './compliance.service'
import {
  createComplianceItemSchema,
  updateComplianceItemSchema,
  listComplianceQuerySchema,
  expiringSoonQuerySchema,
} from './compliance.schema'

// ── DASHBOARD & OVERVIEW ──────────────────────────────────────

export async function getComplianceDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await complianceService.getComplianceDashboard(
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getExpiringSoon(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = expiringSoonQuerySchema.parse(req.query)
    const result = await complianceService.getExpiringSoon(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result, count: result.length })
  } catch (err) { next(err) }
}

export async function refreshAllStatuses(req: Request, res: Response, next: NextFunction) {
  try {
    const thresholdDays = Number(req.query.thresholdDays ?? 30)
    const result = await complianceService.refreshAllStatuses(thresholdDays)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── ENTITY-SCOPED COMPLIANCE ──────────────────────────────────

export async function getVehicleCompliance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await complianceService.getVehicleCompliance(req.params.vehicleId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getCustomerCompliance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await complianceService.getCustomerCompliance(req.params.customerId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── COMPLIANCE ITEMS CRUD ─────────────────────────────────────

export async function listComplianceItems(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listComplianceQuerySchema.parse(req.query)
    const result = await complianceService.listComplianceItems(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}

export async function createComplianceItem(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = createComplianceItemSchema.parse(req.body)
    const result = await complianceService.createComplianceItem(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getComplianceItemById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await complianceService.getComplianceItemById(req.params.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function updateComplianceItem(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateComplianceItemSchema.parse(req.body)
    const result = await complianceService.updateComplianceItem(req.params.id, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function deleteComplianceItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await complianceService.deleteComplianceItem(req.params.id, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}
