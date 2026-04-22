// ============================================================
// BILLING MODULE — ZOD VALIDATION SCHEMAS
// All request body shapes validated before hitting the service
// ============================================================

import { z } from 'zod'

// ── Payment Methods ──────────────────────────────────────────
export const PaymentMethodEnum = z.enum([
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'EFT',
])

// ── Payment Types ────────────────────────────────────────────
export const PaymentTypeEnum = z.enum([
  'RENTAL_FEE',
  'DEPOSIT',
  'DAMAGE_CHARGE',
  'EXTENSION_FEE',
  'OTHER',
])

// ── CREATE PAYMENT ───────────────────────────────────────────
// Used when collecting money against a booking
export const createPaymentSchema = z.object({
  bookingId:     z.string().cuid({ message: 'Invalid booking ID' }),
  amount:        z.number().positive({ message: 'Amount must be greater than 0' }),
  paymentType:   PaymentTypeEnum,
  paymentMethod: PaymentMethodEnum,
  reference:     z.string().max(100).optional(),
  notes:         z.string().max(500).optional(),
  paidAt:        z.coerce.date().optional(), // defaults to now()
})

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>

// ── COLLECT FULL BOOKING PAYMENT ─────────────────────────────
// Collects rental fee + deposit in one transaction
export const collectBookingPaymentSchema = z.object({
  bookingId:          z.string().cuid(),
  rentalFeeMethod:    PaymentMethodEnum,
  depositMethod:      PaymentMethodEnum,
  rentalReference:    z.string().max(100).optional(),
  depositReference:   z.string().max(100).optional(),
  notes:              z.string().max(500).optional(),
})

export type CollectBookingPaymentDto = z.infer<typeof collectBookingPaymentSchema>

// ── PROCESS REFUND ───────────────────────────────────────────
// Decision on what to do with the held deposit
export const processRefundSchema = z.object({
  depositId:       z.string().cuid({ message: 'Invalid deposit ID' }),
  refundMethod:    PaymentMethodEnum,
  deductionAmount: z.number().min(0).default(0),
  deductionReason: z.string().max(500).optional(),
  reference:       z.string().max(100).optional(),
  reason:          z.string().max(500).optional(),
}).refine(
  (data) => {
    // deductionReason is required if deductionAmount > 0
    if (data.deductionAmount > 0 && !data.deductionReason) return false
    return true
  },
  {
    message: 'A reason is required when making a deduction',
    path: ['deductionReason'],
  }
)

export type ProcessRefundDto = z.infer<typeof processRefundSchema>

// ── LIST DEPOSITS QUERY ──────────────────────────────────────
export const listDepositsQuerySchema = z.object({
  status:     z.enum(['HELD', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FORFEITED', 'APPLIED']).optional(),
  locationId: z.string().cuid().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
})

export type ListDepositsQuery = z.infer<typeof listDepositsQuerySchema>

// ── LIST PAYMENTS QUERY ──────────────────────────────────────
export const listPaymentsQuerySchema = z.object({
  bookingId:   z.string().cuid().optional(),
  paymentType: PaymentTypeEnum.optional(),
  from:        z.coerce.date().optional(),
  to:          z.coerce.date().optional(),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
})

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>
