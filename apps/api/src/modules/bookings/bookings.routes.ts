// ============================================================
// BOOKINGS MODULE — ROUTES
// ============================================================

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import {
  checkAvailability,
  createBooking,
  getBookingById,
  listBookings,
  updateBooking,
  cancelBooking,
  allocateVehicle,
  markNoShow,
  getCalendarView,
  getUpcomingBookings,
  getOverdueBookings,
} from './bookings.controller'

const router = Router()
router.use(authenticate)

// ── AVAILABILITY & CALENDAR ───────────────────────────────────

/**
 * GET /api/v1/bookings/available
 * Check which vehicles are available for a date range + location.
 * Used by agents before creating a booking.
 * Query: startDate, endDate, locationId, category (optional)
 */
router.get('/available', authorize('AGENT', 'MANAGER', 'OWNER'), checkAvailability)

/**
 * GET /api/v1/bookings/calendar
 * Gantt-style calendar view grouped by vehicle for a given month/year.
 * Query: locationId, month, year, vehicleId (optional)
 */
router.get('/calendar', authorize('AGENT', 'MANAGER', 'OWNER'), getCalendarView)

/**
 * GET /api/v1/bookings/upcoming
 * Bookings starting in the next N days (default: 7).
 * Query: days (optional)
 */
router.get('/upcoming', authorize('AGENT', 'MANAGER', 'OWNER'), getUpcomingBookings)

/**
 * GET /api/v1/bookings/overdue
 * ACTIVE bookings past their end date — vehicles not returned yet.
 */
router.get('/overdue', authorize('MANAGER', 'OWNER'), getOverdueBookings)

// ── BOOKINGS CRUD ─────────────────────────────────────────────

/**
 * GET /api/v1/bookings
 * List all bookings with filters.
 */
router.get('/', authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'), listBookings)

/**
 * POST /api/v1/bookings
 * Create a new booking (status = PENDING).
 * Payment must be collected separately via billing module.
 */
router.post('/', authorize('AGENT', 'MANAGER', 'OWNER'), createBooking)

/**
 * GET /api/v1/bookings/:id
 * Full booking detail including payments, deposit, inspections, contract.
 */
router.get('/:id', authorize('AGENT', 'MANAGER', 'FINANCE', 'OWNER'), getBookingById)

/**
 * PUT /api/v1/bookings/:id
 * Update booking dates/notes. Only works on PENDING bookings.
 */
router.put('/:id', authorize('AGENT', 'MANAGER', 'OWNER'), updateBooking)

// ── STATUS TRANSITIONS ────────────────────────────────────────

/**
 * POST /api/v1/bookings/:id/cancel
 * Cancel a PENDING or CONFIRMED booking.
 * Body: { reason: string }
 */
router.post('/:id/cancel', authorize('MANAGER', 'OWNER'), cancelBooking)

/**
 * POST /api/v1/bookings/:id/allocate
 * Atomically reserve the vehicle for a CONFIRMED + fully-paid booking.
 * Sets Vehicle.status = RESERVED.
 */
router.post('/:id/allocate', authorize('AGENT', 'MANAGER', 'OWNER'), allocateVehicle)

/**
 * POST /api/v1/bookings/:id/no-show
 * Mark a CONFIRMED booking as NO_SHOW.
 * Releases vehicle back to AVAILABLE.
 */
router.post('/:id/no-show', authorize('MANAGER', 'OWNER'), markNoShow)

export { router as bookingsRouter }
