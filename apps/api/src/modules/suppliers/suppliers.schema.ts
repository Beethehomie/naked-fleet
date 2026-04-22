// ============================================================
// SUPPLIERS MODULE — ZOD VALIDATION SCHEMAS
// ============================================================

import { z } from 'zod'

// ── CREATE SUPPLIER ───────────────────────────────────────────
export const createSupplierSchema = z.object({
  name:        z.string().min(2).max(100),
  contactName: z.string().max(100).optional(),
  email:       z.string().email().optional(),
  phone:       z.string().max(20).optional(),
  address:     z.string().max(300).optional(),
  bankName:    z.string().max(100).optional(),
  bankAccount: z.string().max(50).optional(),
  bankBranch:  z.string().max(50).optional(),
  notes:       z.string().max(1000).optional(),
})

export type CreateSupplierDto = z.infer<typeof createSupplierSchema>

// ── UPDATE SUPPLIER ───────────────────────────────────────────
export const updateSupplierSchema = createSupplierSchema.partial()

export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>

// ── CREATE SUPPLIER CONTRACT ──────────────────────────────────
export const createSupplierContractSchema = z.object({
  supplierId:  z.string().cuid(),
  vehicleId:   z.string().cuid().optional(),  // link to specific vehicle (optional)
  startDate:   z.coerce.date(),
  endDate:     z.coerce.date().optional(),
  monthlyFee:  z.number().positive(),
  terms:       z.string().max(2000).optional(),
  documentUrl: z.string().url().optional(),
}).refine(
  (d) => !d.endDate || d.endDate > d.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
)

export type CreateSupplierContractDto = z.infer<typeof createSupplierContractSchema>

// ── UPDATE SUPPLIER CONTRACT ──────────────────────────────────
export const updateSupplierContractSchema = z.object({
  endDate:     z.coerce.date().optional(),
  monthlyFee:  z.number().positive().optional(),
  terms:       z.string().max(2000).optional(),
  documentUrl: z.string().url().optional(),
  isActive:    z.boolean().optional(),
})

export type UpdateSupplierContractDto = z.infer<typeof updateSupplierContractSchema>

// ── LIST SUPPLIERS QUERY ──────────────────────────────────────
export const listSuppliersQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})

export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>

// ── LIST CONTRACTS QUERY ──────────────────────────────────────
export const listContractsQuerySchema = z.object({
  supplierId: z.string().cuid().optional(),
  vehicleId:  z.string().cuid().optional(),
  isActive:   z.coerce.boolean().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
})

export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>
