// ============================================================
// INSPECTIONS MODULE — ZOD VALIDATION SCHEMAS
// ============================================================

import { z } from 'zod'

// ── ENUMS ─────────────────────────────────────────────────────
export const DamageSeverityEnum = z.enum(['MINOR', 'MODERATE', 'MAJOR', 'TOTALED'])

// ── DAMAGE ITEM ───────────────────────────────────────────────
// Used inside both checkout and checkin schemas
export const damageItemSchema = z.object({
  location:      z.string().min(2).max(100),   // "Front bumper", "Driver door"
  description:   z.string().min(3).max(500),
  severity:      DamageSeverityEnum,
  estimatedCost: z.number().positive().optional(),
  photoUrl:      z.string().url().optional(),  // uploaded to cloud storage first
})

export type DamageItemDto = z.infer<typeof damageItemSchema>

// ── CHECK-OUT INSPECTION ──────────────────────────────────────
// Performed BEFORE vehicle is handed to customer.
// All damage logged here is isPreExisting = true.
export const checkoutInspectionSchema = z.object({
  bookingId:         z.string().cuid(),
  mileageAtTime:     z.number().int().min(0),
  fuelLevel:         z.number().int().min(0).max(100),
  customerSignature: z.string().optional(),     // URL or base64 of signature
  notes:             z.string().max(1000).optional(),
  // Pre-existing damage noted at checkout
  damageItems:       z.array(damageItemSchema).default([]),
})

export type CheckoutInspectionDto = z.infer<typeof checkoutInspectionSchema>

// ── CHECK-IN INSPECTION ───────────────────────────────────────
// Performed AFTER vehicle is returned by customer.
// All new damage logged here is isPreExisting = false → chargeable.
export const checkinInspectionSchema = z.object({
  bookingId:         z.string().cuid(),
  mileageAtTime:     z.number().int().min(0),
  fuelLevel:         z.number().int().min(0).max(100),
  customerSignature: z.string().optional(),
  notes:             z.string().max(1000).optional(),
  // New damage discovered at return
  newDamageItems:    z.array(damageItemSchema).default([]),
})

export type CheckinInspectionDto = z.infer<typeof checkinInspectionSchema>

// ── ADD DAMAGE ITEM (ad-hoc, post-inspection) ─────────────────
export const addDamageItemSchema = z.object({
  inspectionId:  z.string().cuid(),
  location:      z.string().min(2).max(100),
  description:   z.string().min(3).max(500),
  severity:      DamageSeverityEnum,
  estimatedCost: z.number().positive().optional(),
  actualCost:    z.number().positive().optional(),
  photoUrl:      z.string().url().optional(),
  isPreExisting: z.boolean().default(false),
})

export type AddDamageItemDto = z.infer<typeof addDamageItemSchema>

// ── UPDATE DAMAGE ITEM ────────────────────────────────────────
// For updating cost actuals after repair quotes are received
export const updateDamageItemSchema = z.object({
  description:   z.string().min(3).max(500).optional(),
  severity:      DamageSeverityEnum.optional(),
  estimatedCost: z.number().positive().optional(),
  actualCost:    z.number().positive().optional(),
  photoUrl:      z.string().url().optional(),
})

export type UpdateDamageItemDto = z.infer<typeof updateDamageItemSchema>

// ── LIST INSPECTIONS QUERY ────────────────────────────────────
export const listInspectionsQuerySchema = z.object({
  type:      z.enum(['CHECK_OUT', 'CHECK_IN']).optional(),
  vehicleId: z.string().cuid().optional(),
  from:      z.coerce.date().optional(),
  to:        z.coerce.date().optional(),
  hasDamage: z.coerce.boolean().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
})

export type ListInspectionsQuery = z.infer<typeof listInspectionsQuerySchema>
