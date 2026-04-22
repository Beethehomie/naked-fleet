// ============================================================
// SUPPLIERS MODULE — CONTROLLER
// Parse request → call service → respond. No logic here.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { suppliersService } from './suppliers.service'
import {
  createSupplierSchema,
  updateSupplierSchema,
  createSupplierContractSchema,
  updateSupplierContractSchema,
  listSuppliersQuerySchema,
  listContractsQuerySchema,
} from './suppliers.schema'

// ── SUPPLIERS ─────────────────────────────────────────────────

export async function listSuppliers(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listSuppliersQuerySchema.parse(req.query)
    const result = await suppliersService.listSuppliers(query)
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = createSupplierSchema.parse(req.body)
    const result = await suppliersService.createSupplier(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getSupplierById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await suppliersService.getSupplierById(req.params.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateSupplierSchema.parse(req.body)
    const result = await suppliersService.updateSupplier(req.params.id, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function deactivateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await suppliersService.deactivateSupplier(req.params.id, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getSupplierCostSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await suppliersService.getSupplierCostSummary()
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getExpiringContracts(req: Request, res: Response, next: NextFunction) {
  try {
    const days   = Number(req.query.days ?? 30)
    const result = await suppliersService.getExpiringContracts(days)
    return res.status(200).json({ success: true, data: result, count: result.length })
  } catch (err) { next(err) }
}

// ── CONTRACTS ─────────────────────────────────────────────────

export async function listContracts(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listContractsQuerySchema.parse(req.query)
    const result = await suppliersService.listContracts(query)
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}

export async function createContract(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = createSupplierContractSchema.parse(req.body)
    const result = await suppliersService.createContract(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getContractById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await suppliersService.getContractById(req.params.contractId)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function updateContract(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateSupplierContractSchema.parse(req.body)
    const result = await suppliersService.updateContract(req.params.contractId, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function terminateContract(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await suppliersService.terminateContract(req.params.contractId, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function recordMonthlyFeePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const forMonth = req.body.forMonth ? new Date(req.body.forMonth) : undefined
    const result   = await suppliersService.recordMonthlyFeePayment(
      req.params.contractId,
      req.user.id,
      forMonth
    )
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}
