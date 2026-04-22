// ============================================================
// BOOKINGS JOB
// Two responsibilities, both run daily:
//
// 1. OVERDUE ALERT — ACTIVE bookings past their endDate.
//    Notifies MANAGER/OWNER with vehicle + customer details.
//
// 2. UPCOMING REMINDER — CONFIRMED bookings starting within
//    24 hours. Notifies the assigned AGENT + MANAGER so they
//    can prepare the vehicle and checkout paperwork.
// ============================================================

import { prisma }   from '../config/database'
import { env }      from '../config/env'
import { logger }   from '../shared/logger'
import { sendEmail, emailTemplate } from '../shared/notification.service'

// ── 1. OVERDUE BOOKINGS ────────────────────────────────────────

export async function runOverdueBookingsJob(): Promise<void> {
  logger.info('[bookings.job] Starting overdue bookings scan')

  const now = new Date()

  const overdueBookings = await prisma.booking.findMany({
    where: {
      status:    'ACTIVE',
      endDate:   { lt: now },
      deletedAt: null,
    },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      vehicle:  { select: { registrationNo: true, make: true, model: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: { endDate: 'asc' },
  })

  if (overdueBookings.length === 0) {
    logger.info('[bookings.job] No overdue bookings')
    return
  }

  // Group by location
  const locationMap = new Map<string, typeof overdueBookings>()

  for (const booking of overdueBookings) {
    const locId = booking.locationId
    if (!locationMap.has(locId)) locationMap.set(locId, [])
    locationMap.get(locId)!.push(booking)
  }

  for (const [locationId, bookings] of locationMap.entries()) {
    const locationName = bookings[0].location.name

    const users = await prisma.user.findMany({
      where: {
        status:    'ACTIVE',
        deletedAt: null,
        OR: [
          { role: 'MANAGER', locationId },
          { role: 'OWNER' },
        ],
      },
      select: { email: true },
    })

    const recipients = [...new Set([
      ...users.map(u => u.email),
      ...(env.ALERT_RECIPIENTS ? env.ALERT_RECIPIENTS.split(',').map(e => e.trim()) : []),
    ])].filter(Boolean)

    if (recipients.length === 0) {
      logger.warn('[bookings.job] No overdue recipients for location', { locationId })
      continue
    }

    const tableRows = bookings.map(b => {
      const daysOverdue = Math.floor(
        (now.getTime() - b.endDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      return `
        <tr>
          <td>${b.bookingRef}</td>
          <td>${b.customer.firstName} ${b.customer.lastName}</td>
          <td>${b.customer.phone ?? '—'}</td>
          <td>${b.vehicle.registrationNo} — ${b.vehicle.make} ${b.vehicle.model}</td>
          <td>${b.endDate.toISOString().split('T')[0]}</td>
          <td><span class="badge badge-red">${daysOverdue}d overdue</span></td>
        </tr>`
    }).join('')

    const bodyHtml = `
      <p>
        <strong>${bookings.length} booking(s)</strong> at
        <strong>${locationName}</strong> are currently active past their
        scheduled return date. Immediate follow-up is required.
      </p>

      <table>
        <thead>
          <tr>
            <th>Booking Ref</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Vehicle</th>
            <th>Due Date</th>
            <th>Overdue</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <p>
        Contact the customer immediately. If the vehicle is unaccounted for,
        escalate to the claims department.
      </p>
    `

    await sendEmail({
      to:      recipients,
      subject: `🚨 [${locationName}] ${bookings.length} Overdue Booking(s) — Immediate Action Required`,
      html:    emailTemplate('Overdue Bookings Alert', bodyHtml),
      text:    `${bookings.length} overdue booking(s) at ${locationName}. Log in to RentalOS to take action.`,
    })

    logger.info('[bookings.job] Overdue alert sent', {
      location: locationName,
      count:    bookings.length,
    })
  }

  logger.info('[bookings.job] Overdue scan complete', {
    total: overdueBookings.length,
  })
}

// ── 2. UPCOMING BOOKING REMINDERS ─────────────────────────────

export async function runUpcomingBookingReminderJob(): Promise<void> {
  logger.info('[bookings.job] Starting upcoming booking reminder scan')

  const now         = new Date()
  const in24Hours   = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // CONFIRMED bookings starting within the next 24 hours
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      status:    'CONFIRMED',
      startDate: { gte: now, lte: in24Hours },
      deletedAt: null,
    },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      vehicle:  {
        select: {
          registrationNo: true,
          make:           true,
          model:          true,
          color:          true,
          fuelType:       true,
        },
      },
      location: { select: { id: true, name: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  if (upcomingBookings.length === 0) {
    logger.info('[bookings.job] No upcoming bookings in next 24h')
    return
  }

  // Group by location
  const locationMap = new Map<string, typeof upcomingBookings>()

  for (const booking of upcomingBookings) {
    const locId = booking.locationId
    if (!locationMap.has(locId)) locationMap.set(locId, [])
    locationMap.get(locId)!.push(booking)
  }

  for (const [locationId, bookings] of locationMap.entries()) {
    const locationName = bookings[0].location.name

    // Agents + managers at this location
    const users = await prisma.user.findMany({
      where: {
        status:    'ACTIVE',
        deletedAt: null,
        OR: [
          { role: { in: ['AGENT', 'MANAGER'] }, locationId },
          { role: 'OWNER' },
        ],
      },
      select: { email: true },
    })

    const recipients = [...new Set([
      ...users.map(u => u.email),
      ...(env.ALERT_RECIPIENTS ? env.ALERT_RECIPIENTS.split(',').map(e => e.trim()) : []),
    ])].filter(Boolean)

    if (recipients.length === 0) {
      logger.warn('[bookings.job] No upcoming recipients for location', { locationId })
      continue
    }

    const tableRows = bookings.map(b => {
      const hoursUntil = Math.round(
        (b.startDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      )

      return `
        <tr>
          <td>${b.bookingRef}</td>
          <td>${b.customer.firstName} ${b.customer.lastName}</td>
          <td>${b.customer.phone ?? '—'}</td>
          <td>${b.vehicle.registrationNo} — ${b.vehicle.make} ${b.vehicle.model}</td>
          <td>${b.startDate.toISOString().split('T')[0]} ${b.startDate.toTimeString().slice(0,5)}</td>
          <td><span class="badge badge-blue">in ${hoursUntil}h</span></td>
        </tr>`
    }).join('')

    const bodyHtml = `
      <p>
        <strong>${bookings.length} booking(s)</strong> at
        <strong>${locationName}</strong> are scheduled to start within the next
        <strong>24 hours</strong>. Please ensure vehicles are prepared and
        checkout inspections are ready.
      </p>

      <table>
        <thead>
          <tr>
            <th>Booking Ref</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Vehicle</th>
            <th>Start Time</th>
            <th>Starts In</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <p>
        Complete the checkout inspection in RentalOS at the time of vehicle handover
        to officially activate the booking.
      </p>
    `

    await sendEmail({
      to:      recipients,
      subject: `📋 [${locationName}] ${bookings.length} Upcoming Checkout(s) in the Next 24 Hours`,
      html:    emailTemplate('Upcoming Bookings Reminder', bodyHtml),
      text:    `${bookings.length} booking(s) starting in the next 24h at ${locationName}. Prepare for checkout.`,
    })

    logger.info('[bookings.job] Upcoming reminder sent', {
      location: locationName,
      count:    bookings.length,
    })
  }

  logger.info('[bookings.job] Upcoming reminder scan complete', {
    total: upcomingBookings.length,
  })
}
