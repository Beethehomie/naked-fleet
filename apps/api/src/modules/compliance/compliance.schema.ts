// ============================================================
// COMPLIANCE MODULE — ZOD VALIDATION SCHEMAS
// ============================================================

import { z } from 'zod'

// ── ENUMS ─────────────────────────────────────────────────────
export const ComplianceItemTypeEnum = z.enum([
  'DRIVERS_LICENCE',
  'VEHICLE_LICENCE',
  'ROADWORTHY',
  'INSURANCE_POLICY',
  'PDP_PERMIT',
  'OPERATOR_PERMIT',
  'OTHER',
])

export const ComplianceStatusEnum = z.enum([
  'VALID',
  'EXPIRING_SOON',   // Within threshold days (default: 30)
  'EXPIRED',
  'MISSING',
])

export const EntityTypeEnum = z.enum(['vehicle', 'customer', 'company'])

// ── CREATE COMPLIANCE ITEM ────────────────────────────────────
export const createComplianceItemSchema = z.object({
  type:        ComplianceItemTypeEnum,
  entityType:  EntityTypeEnum,
  vehicleId:   z.string().cuid().optional(),
  customerId:  z.string().cuid().optional(),
  referenceNo: z.string().max(100).optional(),
  issueDate:   z.coerce.date().optional(),
  expiryDate:  z.coerce.date().optional(),
  issuingBody: z.string().max(200).optional(),
  documentUrl: z.string().url().optional(),
  notes:       z.string().max(1000).optional(),
})
.refine(
  (d) => {
    if (d.entityType === 'vehicle'  && !d.vehicleId)  return false
    if (d.entityType === 'customer' && !d.customerId) return false
    return true
  },
  { message: 'vehicleId required for vehicle items; customerId required for customer items' }
)
.refine(
  (d) => !d.issueDate || !d.expiryDate || d.expiryDate > d.issueDate,
  { message: 'Expiry date must be after issue date', path: ['expiryDate'] }
)

export type CreateComplianceItemDto = z.infer<typeof createComplianceItemSchema>

// ── UPDATE COMPLIANCE ITEM ────────────────────────────────────
export const updateComplianceItemSchema = z.object({
  referenceNo: z.string().max(100).optional(),
  issueDate:   z.coerce.date().optional(),
  expiryDate:  z.coerce.date().optional(),
  issuingBody: z.string().max(200).optional(),
  documentUrl: z.string().url().optional(),
  notes:       z.string().max(1000).optional(),
})

export type UpdateComplianceItemDto = z.infer<typeof updateComplianceItemSchema>

// ── LIST COMPLIANCE QUERY ─────────────────────────────────────
export const listComplianceQuerySchema = z.object({
  type:       ComplianceItemTypeEnum.optional(),
  status:     ComplianceStatusEnum.optional(),
  entityType: EntityTypeEnum.optional(),
  vehicleId:  z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
})

export type ListComplianceQuery = z.infer<typeof listComplianceQuerySchema>

// ── EXPIRING SOON QUERY ───────────────────────────────────────
export const expiringSoonQuerySchema = z.object({
  withinDays:  z.coerce.number().int().min(1).max(365).default(30),
  entityType:  EntityTypeEnum.optional(),
  type:        ComplianceItemTypeEnum.optional(),
  locationId:  z.string().cuid().optional(),
})

export type ExpiringSoonQuery = z.infer<typeof expiringSoonQuerySchema>
