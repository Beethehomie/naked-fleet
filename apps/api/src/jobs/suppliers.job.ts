// ============================================================
// SUPPLIERS JOB
// Two responsibilities:
//
// 1. MONTHLY FEE REMINDER — runs on the 1st of each month.
//    Finds all active supplier contracts and reminds FINANCE
//    / MANAGER to record the monthly lease payment via the
//    supplier module endpoint.
//
// 2. EXPIRING CONTRACT ALERT — runs daily.
//    Finds contracts expiring within 30 days so operations
//    can negotiate renewal before the vehicle reverts to
//    uncontracted status.
// ============================================================

import { prisma }   from '../config/database'
import { env }      from '../config/env'
import { logger }   from '../shared/logger'
import { sendEmail, emailTemplate } from '../shared/notification.service'

const CONTRACT_EXPIRY_THRESHOLD_DAYS = 30

// ── 1. MONTHLY FEE REMINDER ───────────────────────────────────

export async function runMonthlySupplierFeeReminderJob(): Promise<void> {
  logger.info('[suppliers.job] Starting monthly supplier fee reminder')

  const activeContracts = await prisma.supplierContract.findMany({
    where: {
      status:    'ACTIVE',
      deletedAt: null,
    },
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      vehicle:  { select: { registration: true, make: true, model: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: [
      { locationId: 'asc' },
      { supplier:   { name: 'asc' } },
    ],
  })

  if (activeContracts.length === 0) {
    logger.info('[suppliers.job] No active supplier contracts')
    return
  }

  // Group by location
  const locationMap = new Map<string, typeof activeContracts>()

  for (const contract of activeContracts) {
    const locId = contract.locationId
    if (!locationMap.has(locId)) locationMap.set(locId, [])
    locationMap.get(locId)!.push(contract)
  }

  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })

  for (const [locationId, contracts] of locationMap.entries()) {
    const locationName = contracts[0].location.name

    const users = await prisma.user.findMany({
      where: {
        status:    'ACTIVE',
        deletedAt: null,
        OR: [
          { role: { in: ['FINANCE', 'MANAGER'] }, locationId },
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
      logger.warn('[suppliers.job] No recipients for location', { locationId })
      continue
    }

    const totalMonthlyFees = contracts.reduce(
      (sum, c) => sum + (c.monthlyFee ? Number(c.monthlyFee) : 0),
      0
    )

    const tableRows = contracts.map(contract => {
      const monthlyFee = contract.monthlyFee
        ? `R ${Number(contract.monthlyFee).toFixed(2)}`
        : 'Variable'

      const contractExpiry = contract.endDate
        ? contract.endDate.toISOString().split('T')[0]
        : 'Open-ended'

      return `
        <tr>
          <td>${contract.ref}</td>
          <td>${contract.supplier.name}</td>
          <td>${contract.vehicle.registration} — ${contract.vehicle.make} ${contract.vehicle.model}</td>
          <td><strong>${monthlyFee}</strong></td>
          <td>${contractExpiry}</td>
        </tr>`
    }).join('')

    const bodyHtml = `
      <p>
        This is your monthly reminder to record supplier lease payments for
        <strong>${locationName}</strong> — <strong>${monthLabel}</strong>.
        There are <strong>${contracts.length} active contract(s)</strong> totalling
        approximately <strong>R ${totalMonthlyFees.toFixed(2)}/month</strong>.
      </p>

      <p>
        For each contract, navigate to <em>Suppliers → [Supplier Name] → Record Monthly Payment</em>
        and enter the actual payment amount. This will create a VehicleCost entry (category: Lease)
        for accurate P&amp;L reporting.
      </p>

      <table>
        <thead>
          <tr>
            <th>Contract Ref</th>
            <th>Supplier</th>
            <th>Vehicle</th>
            <th>Monthly Fee</th>
            <th>Contract End</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `

    await sendEmail({
      to:      recipients,
      subject: `📆 [${locationName}] Monthly Supplier Payment Reminder — ${monthLabel}`,
      html:    emailTemplate('Monthly Supplier Fee Reminder', bodyHtml),
      text:    `Record ${contracts.length} supplier payment(s) for ${monthLabel} at ${locationName}. Total approx R ${totalMonthlyFees.toFixed(2)}.`,
    })

    logger.info('[suppliers.job] Monthly reminder sent', {
      location:  locationName,
      contracts: contracts.length,
      totalFees: totalMonthlyFees,
    })
  }

  logger.info('[suppliers.job] Monthly fee reminder complete', {
    totalContracts: activeContracts.length,
  })
}

// ── 2. EXPIRING CONTRACT ALERT ────────────────────────────────

export async function runExpiringContractJob(): Promise<void> {
  logger.info('[suppliers.job] Starting expiring contract scan')

  const now          = new Date()
  const cutoffDate   = new Date(now.getTime() + CONTRACT_EXPIRY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

  const expiringContracts = await prisma.supplierContract.findMany({
    where: {
      status:    'ACTIVE',
      endDate:   { gte: now, lte: cutoffDate },
      deletedAt: null,
    },
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      vehicle:  { select: { registration: true, make: true, model: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: { endDate: 'asc' },
  })

  if (expiringContracts.length === 0) {
    logger.info('[suppliers.job] No expiring contracts within threshold', {
      thresholdDays: CONTRACT_EXPIRY_THRESHOLD_DAYS,
    })
    return
  }

  // Group by location
  const locationMap = new Map<string, typeof expiringContracts>()

  for (const contract of expiringContracts) {
    const locId = contract.locationId
    if (!locationMap.has(locId)) locationMap.set(locId, [])
    locationMap.get(locId)!.push(contract)
  }

  for (const [locationId, contracts] of locationMap.entries()) {
    const locationName = contracts[0].location.name

    const users = await prisma.user.findMany({
      where: {
        status:    'ACTIVE',
        deletedAt: null,
        OR: [
          { role: { in: ['MANAGER', 'FINANCE'] }, locationId },
          { role: 'OWNER' },
        ],
      },
      select: { email: true },
    })

    const recipients = [...new Set([
      ...users.map(u => u.email),
      ...(env.ALERT_RECIPIENTS ? env.ALERT_RECIPIENTS.split(',').map(e => e.trim()) : []),
    ])].filter(Boolean)

    if (recipients.length === 0) continue

    const tableRows = contracts.map(contract => {
      const daysLeft = Math.ceil(
        (contract.endDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      const badgeClass = daysLeft <= 7 ? 'badge-red' : 'badge-yellow'

      return `
        <tr>
          <td>${contract.ref}</td>
          <td>${contract.supplier.name}</td>
          <td>${contract.vehicle.registration} — ${contract.vehicle.make} ${contract.vehicle.model}</td>
          <td>${contract.endDate!.toISOString().split('T')[0]}</td>
          <td><span class="badge ${badgeClass}">${daysLeft}d left</span></td>
        </tr>`
    }).join('')

    const bodyHtml = `
      <p>
        <strong>${contracts.length} supplier contract(s)</strong> at
        <strong>${locationName}</strong> will expire within
        <strong>${CONTRACT_EXPIRY_THRESHOLD_DAYS} days</strong>.
        Please contact the relevant suppliers to negotiate renewal before the
        vehicle ownership reverts to direct ownership.
      </p>

      <table>
        <thead>
          <tr>
            <th>Contract Ref</th>
            <th>Supplier</th>
            <th>Vehicle</th>
            <th>Expiry Date</th>
            <th>Time Left</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `

    await sendEmail({
      to:      recipients,
      subject: `⏰ [${locationName}] ${contracts.length} Supplier Contract(s) Expiring Soon`,
      html:    emailTemplate('Expiring Supplier Contracts', bodyHtml),
      text:    `${contracts.length} supplier contract(s) expiring within ${CONTRACT_EXPIRY_THRESHOLD_DAYS} days at ${locationName}.`,
    })

    logger.info('[suppliers.job] Expiring contract alert sent', {
      location:  locationName,
      contracts: contracts.length,
    })
  }

  logger.info('[suppliers.job] Expiring contract scan complete', {
    totalExpiring: expiringContracts.length,
  })
}
