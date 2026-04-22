// ============================================================
// BOOKINGS MODULE — CONTROLLER
// Parse request → call service → respond. No logic here.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { bookingsService } from './bookings.service'
import {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
  availabilityQuerySchema,
  listBookingsQuerySchema,
  calendarQuerySchema,
} from './bookings.schema'

// ── AVAILABILITY ──────────────────────────────────────────────

export async function checkAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = availabilityQuerySchema.parse(req.query)
    const result = await bookingsService.checkAvailability(query)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── BOOKINGS CRUD ─────────────────────────────────────────────

export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = createBookingSchema.parse(req.body)
    const result = await bookingsService.createBooking(dto, req.user.id)
    return res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getBookingById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bookingsService.getBookingById(req.params.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function listBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = listBookingsQuerySchema.parse(req.query)
    const result = await bookingsService.listBookings(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, ...result })
  } catch (err) { next(err) }
}

export async function updateBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = updateBookingSchema.parse(req.body)
    const result = await bookingsService.updateBooking(req.params.id, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── STATUS TRANSITIONS ────────────────────────────────────────

export async function cancelBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const dto    = cancelBookingSchema.parse(req.body)
    const result = await bookingsService.cancelBooking(req.params.id, dto, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function allocateVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bookingsService.confirmBookingAndAllocateVehicle(
      req.params.id,
      req.user.id
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function markNoShow(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bookingsService.markNoShow(req.params.id, req.user.id)
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── CALENDAR & DASHBOARD ──────────────────────────────────────

export async function getCalendarView(req: Request, res: Response, next: NextFunction) {
  try {
    const query  = calendarQuerySchema.parse(req.query)
    const result = await bookingsService.getCalendarView(
      query,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getUpcomingBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const days   = Number(req.query.days ?? 7)
    const result = await bookingsService.getUpcomingBookings(
      days,
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function getOverdueBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bookingsService.getOverdueBookings(
      req.user.locationId,
      req.user.role === 'OWNER'
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) { next(err) }
}
