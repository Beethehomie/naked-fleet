// ============================================================
// UNRESOLVED DEPOSIT JOB
// Runs daily. Finds COMPLETED bookings whose deposit is still
// HELD beyond DEPOSIT_CHASE_DAYS, alerting FINANCE/MANAGER
// to process refund or forfeiture.
//
// Why this matters: unresolved deposits are a liability on the
// balance sheet. Finance needs to action them promptly.
// ============================================================

import { prisma }   from '../config/database'
import { env }      from '../config/env'
import { logger }   from '../shared/logger'
import { sendEmail, emailTemplate } from '../shared/notification.service'

// ── Job function ───────────────────────────────────────────────

export async function runUnresolvedDepositJob(): Promise<void> {
  logger.info('[deposits.job] Starting unresolved deposit scan')

  const chaseDays    = env.DEPOSIT_CHASE_DAYS
  const cutoffDate   = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - chaseDays)

  // Find deposits that are still HELD on COMPLETED bookings
  // where the booking ended more than DEPOSIT_CHASE_DAYS ago
  const unresolvedDeposits = await prisma.deposit.findMany({
    where: {
      status: 'HELD',
      booking: {
        status:  'COMPLETED',
        endDate: { lt: cutoffDate },
      },
    },
    include: {
      booking: {
        include: {
          customer:  { select: { firstName: true, lastName: true, email: true, phone: true } },
          vehicle:   { select: { registration: true, make: true, model: true } },
          location:  { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { booking: { endDate: 'asc' } },
  })

  if (unresolvedDeposits.length === 0) {
    logger.info('[deposits.job] No unresolved deposits found')
    return
  }

  // Group by location
  const locationMap = new Map<string, typeof unresolvedDeposits>()

  for (const deposit of unresolvedDeposits) {
    const locId = deposit.booking.locationId
    if (!locationMap.has(locId)) locationMap.set(locId, [])
    locationMap.get(locId)!.push(deposit)
  }

  for (const [locationId, deposits] of locationMap.entries()) {
    const locationName = deposits[0].booking.location.name

    // Notify FINANCE, MANAGER, and OWNERs
    const users = await prisma.user.findMany({
      where: {
        role:      { in: ['FINANCE', 'MANAGER', 'OWNER'] },
        status:    'ACTIVE',
        deletedAt: null,
        OR: [
          { locationId },
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
      logger.warn('[deposits.job] No recipients for location', { locationId })
      continue
    }

    const totalHeld = deposits.reduce(
      (sum, d) => sum + Number(d.amount),
      0
    )

    const tableRows = deposits.map(deposit => {
      const b       = deposit.booking
      const daysSince = Math.floor(
        (Date.now() - b.endDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      return `
        <tr>
          <td>${b.ref}</td>
          <td>${b.customer.firstName} ${b.customer.lastName}</td>
          <td>${b.vehicle.registration} — ${b.vehicle.make} ${b.vehicle.model}</td>
          <td>${b.endDate.toISOString().split('T')[0]}</td>
          <td><span class="badge badge-red">${daysSince}d overdue</span></td>
          <td><strong>R ${Number(deposit.amount).toFixed(2)}</strong></td>
        </tr>`
    }).join('')

    const bodyHtml = `
      <p>
        The following <strong>${deposits.length} deposit(s)</strong> for
        <strong>${locationName}</strong> are still <em>HELD</em> and have not been
        processed more than <strong>${chaseDays} day(s)</strong> after the booking
        ended. Total liability: <strong>R ${totalHeld.toFixed(2)}</strong>.
      </p>
      <p>
        Each deposit must be resolved as either <em>REFUNDED</em>, <em>PARTIALLY REFUNDED</em>,
        or <em>FORFEITED</em> in the billing module.
      </p>

      <table>
        <thead>
          <tr>
            <th>Booking Ref</th>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>End Date</th>
            <th>Days Since End</th>
            <th>Deposit Held</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `

    await sendEmail({
      to:      recipients,
      subject: `💰 [${locationName}] ${deposits.length} Unresolved Deposit(s) — R ${totalHeld.toFixed(2)} Liability`,
      html:    emailTemplate('Unresolved Deposit Alert', bodyHtml),
      text:    `${deposits.length} unresolved deposit(s) totalling R ${totalHeld.toFixed(2)} for ${locationName}. Action required in RentalOS.`,
    })

    logger.info('[deposits.job] Alert sent', {
      location:    locationName,
      deposits:    deposits.length,
      totalLiability: totalHeld,
    })
  }

  logger.info('[deposits.job] Job complete', {
    totalUnresolved: unresolvedDeposits.length,
  })
}
