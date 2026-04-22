// ============================================================
// BOOKINGS MODULE — ZOD VALIDATION SCHEMAS
// ============================================================

import { z } from 'zod'

// ── CREATE BOOKING ───────────────────────────────────────────
export const createBookingSchema = z.object({
  customerId:  z.string().cuid({ message: 'Invalid customer ID' }),
  vehicleId:   z.string().cuid({ message: 'Invalid vehicle ID' }),
  locationId:  z.string().cuid({ message: 'Invalid location ID' }),
  startDate:   z.coerce.date(),
  endDate:     z.coerce.date(),
  notes:       z.string().max(1000).optional(),
}).refine(
  (d) => d.endDate > d.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
).refine(
  (d) => d.startDate >= new Date(new Date().setHours(0, 0, 0, 0)),
  { message: 'Start date cannot be in the past', path: ['startDate'] }
)

export type CreateBookingDto = z.infer<typeof createBookingSchema>

// ── UPDATE BOOKING ───────────────────────────────────────────
// Only PENDING bookings can be updated
export const updateBookingSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate:   z.coerce.date().optional(),
  notes:     z.string().max(1000).optional(),
}).refine(
  (d) => {
    if (d.startDate && d.endDate) return d.endDate > d.startDate
    return true
  },
  { message: 'End date must be after start date', path: ['endDate'] }
)

export type UpdateBookingDto = z.infer<typeof updateBookingSchema>

// ── CANCEL BOOKING ───────────────────────────────────────────
export const cancelBookingSchema = z.object({
  reason: z.string().min(5, 'Cancellation reason must be at least 5 characters').max(500),
})

export type CancelBookingDto = z.infer<typeof cancelBookingSchema>

// ── CHECK AVAILABILITY ───────────────────────────────────────
export const availabilityQuerySchema = z.object({
  startDate:  z.coerce.date(),
  endDate:    z.coerce.date(),
  locationId: z.string().cuid(),
  category:   z.string().optional(),
}).refine(
  (d) => d.endDate > d.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
)

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>

// ── LIST BOOKINGS QUERY ──────────────────────────────────────
export const listBookingsQuerySchema = z.object({
  status:     z.enum(['PENDING','CONFIRMED','ACTIVE','COMPLETED','CANCELLED','NO_SHOW']).optional(),
  customerId: z.string().cuid().optional(),
  vehicleId:  z.string().cuid().optional(),
  locationId: z.string().cuid().optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
})

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>

// ── CALENDAR QUERY ───────────────────────────────────────────
export const calendarQuerySchema = z.object({
  locationId: z.string().cuid(),
  month:      z.coerce.number().int().min(1).max(12),
  year:       z.coerce.number().int().min(2020).max(2099),
  vehicleId:  z.string().cuid().optional(),
})

export type CalendarQuery = z.infer<typeof calendarQuerySchema>
