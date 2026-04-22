// ============================================================
// INSPECTIONS MODULE — CONTROLLER
// Parse request → call service → respond. No logic here.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { inspectionsService } from './inspections.service'
import {
  checkoutInspectionSchema,
  checkinInspectionSchema,
  addDamageItemSchema,
  updateDamageItemSchema,
  listInspectionsQuerySchema,
} from './inspections.schema'

// ── INSPECTIONS ───────────────────────────────────────────────

export async function performCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = checkoutInspectionSchema.parse(req.body)
    const result = await inspectionsService.performCheckout(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function performCheckin(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = checkinInspectionSchema.parse(req.body)
    const result = await inspectionsService.performCheckin(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getInspectionById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inspectionsService.getInspectionById(req.params.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getInspectionsForBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inspectionsService.getInspectionsForBooking(req.params.bookingId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function listInspections(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listInspectionsQuerySchema.parse(req.query)
    const result = await inspectionsService.listInspections(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}

// ── DAMAGE ITEMS ──────────────────────────────────────────────

export async function addDamageItem(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = addDamageItemSchema.parse({ ...req.body, inspectionId: req.params.inspectionId })
    const result = await inspectionsService.addDamageItem(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function updateDamageItem(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateDamageItemSchema.parse(req.body)
    const result = await inspectionsService.updateDamageItem(req.params.damageItemId, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── REPORTS ───────────────────────────────────────────────────

export async function getDamageSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : undefined
    const to   = req.query.to   ? new Date(req.query.to   as string) : undefined
    const result = await inspectionsService.getDamageSummary(
      req.query.locationId as string | undefined,
      req.user.role === 'OWNER',
      from,
      to
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}
