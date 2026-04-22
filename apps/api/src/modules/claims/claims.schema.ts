// ============================================================
// INSURANCE & CLAIMS MODULE — ZOD VALIDATION SCHEMAS
// ============================================================

import { z } from 'zod'

// ── ENUMS ─────────────────────────────────────────────────────
export const ClaimTypeEnum = z.enum(['DAMAGE', 'THEFT', 'THIRD_PARTY', 'WINDSCREEN'])

export const ClaimStatusEnum = z.enum([
  'OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SETTLED', 'CLOSED',
])

// ── CREATE INSURANCE POLICY ───────────────────────────────────
export const createInsurancePolicySchema = z.object({
  vehicleId:    z.string().cuid(),
  provider:     z.string().min(2).max(100),
  policyNumber: z.string().min(2).max(100),
  coverType:    z.string().min(2).max(100),  // Comprehensive, Third Party, etc.
  premium:      z.number().positive(),
  excess:       z.number().min(0),
  startDate:    z.coerce.date(),
  endDate:      z.coerce.date(),
  documentUrl:  z.string().url().optional(),
}).refine(
  (d) => d.endDate > d.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
)

export type CreateInsurancePolicyDto = z.infer<typeof createInsurancePolicySchema>

// ── UPDATE INSURANCE POLICY ───────────────────────────────────
export const updateInsurancePolicySchema = z.object({
  provider:     z.string().min(2).max(100).optional(),
  policyNumber: z.string().min(2).max(100).optional(),
  coverType:    z.string().min(2).max(100).optional(),
  premium:      z.number().positive().optional(),
  excess:       z.number().min(0).optional(),
  startDate:    z.coerce.date().optional(),
  endDate:      z.coerce.date().optional(),
  documentUrl:  z.string().url().optional(),
  isActive:     z.boolean().optional(),
})

export type UpdateInsurancePolicyDto = z.infer<typeof updateInsurancePolicySchema>

// ── OPEN CLAIM ────────────────────────────────────────────────
export const openClaimSchema = z.object({
  vehicleId:         z.string().cuid(),
  bookingId:         z.string().cuid().optional(),
  insurancePolicyId: z.string().cuid().optional(),
  type:              ClaimTypeEnum,
  description:       z.string().min(10).max(2000),
  incidentDate:      z.coerce.date(),
  incidentLocation:  z.string().max(300).optional(),
  estimatedCost:     z.number().positive().optional(),
  notes:             z.string().max(1000).optional(),
}).refine(
  (d) => d.incidentDate <= new Date(),
  { message: 'Incident date cannot be in the future', path: ['incidentDate'] }
)

export type OpenClaimDto = z.infer<typeof openClaimSchema>

// ── UPDATE CLAIM ──────────────────────────────────────────────
export const updateClaimSchema = z.object({
  description:       z.string().min(10).max(2000).optional(),
  incidentLocation:  z.string().max(300).optional(),
  estimatedCost:     z.number().positive().optional(),
  insurancePolicyId: z.string().cuid().optional(),
  notes:             z.string().max(1000).optional(),
})

export type UpdateClaimDto = z.infer<typeof updateClaimSchema>

// ── ADVANCE CLAIM STATUS ──────────────────────────────────────
export const advanceClaimStatusSchema = z.object({
  status:          ClaimStatusEnum,
  settledAmount:   z.number().min(0).optional(),
  excessPaid:      z.number().min(0).optional(),
  notes:           z.string().max(1000).optional(),
}).refine(
  (d) => {
    // settledAmount required when marking SETTLED
    if (d.status === 'SETTLED' && d.settledAmount === undefined) return false
    return true
  },
  { message: 'settledAmount is required when status is SETTLED', path: ['settledAmount'] }
)

export type AdvanceClaimStatusDto = z.infer<typeof advanceClaimStatusSchema>

// ── LIST CLAIMS QUERY ─────────────────────────────────────────
export const listClaimsQuerySchema = z.object({
  status:    ClaimStatusEnum.optional(),
  type:      ClaimTypeEnum.optional(),
  vehicleId: z.string().cuid().optional(),
  bookingId: z.string().cuid().optional(),
  from:      z.coerce.date().optional(),
  to:        z.coerce.date().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
})

export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>

// ── LIST POLICIES QUERY ───────────────────────────────────────
export const listPoliciesQuerySchema = z.object({
  vehicleId: z.string().cuid().optional(),
  isActive:  z.coerce.boolean().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
})

export type ListPoliciesQuery = z.infer<typeof listPoliciesQuerySchema>
