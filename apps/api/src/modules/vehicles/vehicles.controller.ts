// ============================================================
// FLEET MODULE — CONTROLLER
// Parse request → call service → respond. No logic here.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { vehiclesService } from './vehicles.service'
import {
  createVehicleSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema,
  addVehicleCostSchema,
  listVehiclesQuerySchema,
  pnlQuerySchema,
} from './vehicles.schema'

// ── VEHICLES ──────────────────────────────────────────────────

export async function listVehicles(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listVehiclesQuerySchema.parse(req.query)
    const result = await vehiclesService.listVehicles(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}

export async function createVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = createVehicleSchema.parse(req.body)
    const result = await vehiclesService.createVehicle(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getVehicleById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vehiclesService.getVehicleById(req.params.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function updateVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateVehicleSchema.parse(req.body)
    const result = await vehiclesService.updateVehicle(req.params.id, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function updateVehicleStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateVehicleStatusSchema.parse(req.body)
    const result = await vehiclesService.updateVehicleStatus(req.params.id, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function deleteVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vehiclesService.deleteVehicle(req.params.id, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── COSTS ─────────────────────────────────────────────────────

export async function addVehicleCost(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = addVehicleCostSchema.parse({ ...req.body, vehicleId: req.params.id })
    const result = await vehiclesService.addVehicleCost(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function listVehicleCosts(req: Request, res: Response, next: NextFunction) {
  try {
    const from   = req.query.from ? new Date(req.query.from as string) : undefined
    const to     = req.query.to   ? new Date(req.query.to   as string) : undefined
    const result = await vehiclesService.listVehicleCosts(req.params.id, from, to)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── P&L + DASHBOARD ──────────────────────────────────────────

export async function getVehiclePnl(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = pnlQuerySchema.parse(req.query)
    const result = await vehiclesService.getVehiclePnl(req.params.id, query, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getFleetOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await vehiclesService.getFleetOverview(
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getVehicleBookingHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const page   = Number(req.query.page  ?? 1)
    const limit  = Number(req.query.limit ?? 20)
    const result = await vehiclesService.getVehicleBookingHistory(req.params.id, page, limit)
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}
