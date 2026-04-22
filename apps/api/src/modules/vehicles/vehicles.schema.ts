// ============================================================
// FLEET MODULE — ZOD VALIDATION SCHEMAS
// ============================================================

import { z } from 'zod'

// ── ENUMS ─────────────────────────────────────────────────────
export const VehicleStatusEnum = z.enum([
  'AVAILABLE', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'RETIRED', 'RESERVED',
])

export const OwnershipTypeEnum = z.enum(['OWNED', 'LEASED', 'SUPPLIER'])

export const FuelTypeEnum = z.enum(['Petrol', 'Diesel', 'Electric', 'Hybrid'])

export const TransmissionEnum = z.enum(['Manual', 'Automatic'])

// ── CREATE VEHICLE ────────────────────────────────────────────
export const createVehicleSchema = z.object({
  registrationNo:   z.string().min(2).max(20).toUpperCase(),
  make:             z.string().min(1).max(50),
  model:            z.string().min(1).max(50),
  year:             z.number().int().min(1990).max(new Date().getFullYear() + 1),
  color:            z.string().min(1).max(30),
  vin:              z.string().length(17).optional(),
  engineNo:         z.string().max(30).optional(),
  fuelType:         FuelTypeEnum.default('Petrol'),
  transmission:     TransmissionEnum.default('Manual'),
  category:         z.string().min(1).max(50),   // Economy, SUV, Luxury, Minibus, etc.
  seatingCapacity:  z.number().int().min(1).max(60).default(5),
  dailyRate:        z.number().positive(),
  depositAmount:    z.number().positive(),
  ownershipType:    OwnershipTypeEnum.default('OWNED'),
  locationId:       z.string().cuid(),
  supplierId:       z.string().cuid().optional(),
  purchaseDate:     z.coerce.date().optional(),
  purchasePrice:    z.number().positive().optional(),
  insurancePolicyNo: z.string().max(100).optional(),
  mileage:          z.number().int().min(0).default(0),
  notes:            z.string().max(1000).optional(),
}).refine(
  (d) => d.ownershipType === 'SUPPLIER' ? !!d.supplierId : true,
  { message: 'supplierId is required when ownershipType is SUPPLIER', path: ['supplierId'] }
)

export type CreateVehicleDto = z.infer<typeof createVehicleSchema>

// ── UPDATE VEHICLE ────────────────────────────────────────────
export const updateVehicleSchema = z.object({
  make:              z.string().min(1).max(50).optional(),
  model:             z.string().min(1).max(50).optional(),
  color:             z.string().min(1).max(30).optional(),
  category:          z.string().min(1).max(50).optional(),
  dailyRate:         z.number().positive().optional(),
  depositAmount:     z.number().positive().optional(),
  locationId:        z.string().cuid().optional(),
  supplierId:        z.string().cuid().optional(),
  insurancePolicyNo: z.string().max(100).optional(),
  notes:             z.string().max(1000).optional(),
  mileage:           z.number().int().min(0).optional(),
})

export type UpdateVehicleDto = z.infer<typeof updateVehicleSchema>

// ── UPDATE VEHICLE STATUS ─────────────────────────────────────
export const updateVehicleStatusSchema = z.object({
  status: VehicleStatusEnum,
  reason: z.string().max(500).optional(),
})

export type UpdateVehicleStatusDto = z.infer<typeof updateVehicleStatusSchema>

// ── ADD VEHICLE COST ──────────────────────────────────────────
export const addVehicleCostSchema = z.object({
  vehicleId:   z.string().cuid(),
  description: z.string().min(2).max(200),
  amount:      z.number().positive(),
  costDate:    z.coerce.date(),
  category:    z.enum([
    'Maintenance',
    'Insurance',
    'Licensing',
    'Lease',
    'Fuel',
    'Cleaning',
    'Repair',
    'Other',
  ]),
  receiptUrl: z.string().url().optional(),
  notes:      z.string().max(500).optional(),
})

export type AddVehicleCostDto = z.infer<typeof addVehicleCostSchema>

// ── LIST VEHICLES QUERY ───────────────────────────────────────
export const listVehiclesQuerySchema = z.object({
  status:        VehicleStatusEnum.optional(),
  ownershipType: OwnershipTypeEnum.optional(),
  locationId:    z.string().cuid().optional(),
  category:      z.string().optional(),
  supplierId:    z.string().cuid().optional(),
  page:          z.coerce.number().int().min(1).default(1),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
})

export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>

// ── P&L QUERY ─────────────────────────────────────────────────
export const pnlQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to:   z.coerce.date().optional(),
})

export type PnlQuery = z.infer<typeof pnlQuerySchema>
