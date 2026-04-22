// ============================================================
// COMPLIANCE EXPIRY JOB
// Runs daily. Finds all vehicles with compliance items that are
// EXPIRED or EXPIRING_SOON, groups by location, and emails
// the responsible MANAGER/OWNER at each location.
// ============================================================

import { prisma }   from '../config/database'
import { env }      from '../config/env'
import { logger }   from '../shared/logger'
import { sendEmail, emailTemplate } from '../shared/notification.service'
import { deriveStatus } from '../modules/compliance/compliance.service'

// ── Types ─────────────────────────────────────────────────────

interface ComplianceAlert {
  vehicleId:   string
  registration: string
  make:        string
  model:       string
  itemType:    string
  expiryDate:  Date | null
  status:      'EXPIRED' | 'EXPIRING_SOON'
  daysLeft:    number | null
}

interface LocationAlert {
  locationId:   string
  locationName: string
  alerts:       ComplianceAlert[]
  recipients:   string[]
}

// ── Job function ───────────────────────────────────────────────

export async function runComplianceExpiryJob(): Promise<void> {
  logger.info('[compliance.job] Starting compliance expiry scan')

  const threshold = env.COMPLIANCE_THRESHOLD_DAYS
  const now       = new Date()
  const thresholdDate = new Date(now.getTime() + threshold * 24 * 60 * 60 * 1000)

  // Fetch all non-retired vehicles with their compliance items and location
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { not: 'RETIRED' }, deletedAt: null },
    include: {
      location:        { select: { id: true, name: true } },
      complianceItems: { where: { deletedAt: null } },
      insurancePolicies: {
        where:  { isActive: true, deletedAt: null },
        select: { id: true, expiryDate: true },
        take: 1,
      },
    },
  })

  // Build a map of locationId → LocationAlert
  const locationMap = new Map<string, LocationAlert>()

  for (const vehicle of vehicles) {
    const itemsToCheck: Array<{ type: string; expiryDate: Date | null }> = [
      // Structured compliance items (VEHICLE_LICENCE, ROADWORTHY, etc.)
      ...vehicle.complianceItems.map(ci => ({
        type:       ci.itemType,
        expiryDate: ci.expiryDate,
      })),
      // Active insurance policy expiry
      ...(vehicle.insurancePolicies[0]
        ? [{ type: 'INSURANCE_POLICY', expiryDate: vehicle.insurancePolicies[0].expiryDate }]
        : []),
    ]

    for (const item of itemsToCheck) {
      const status = deriveStatus(item.expiryDate, threshold)

      if (status !== 'EXPIRED' && status !== 'EXPIRING_SOON') continue

      const daysLeft = item.expiryDate
        ? Math.ceil((item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null

      const alert: ComplianceAlert = {
        vehicleId:    vehicle.id,
        registration: vehicle.registration,
        make:         vehicle.make,
        model:        vehicle.model,
        itemType:     item.type,
        expiryDate:   item.expiryDate,
        status:       status as 'EXPIRED' | 'EXPIRING_SOON',
        daysLeft,
      }

      if (!locationMap.has(vehicle.locationId)) {
        locationMap.set(vehicle.locationId, {
          locationId:   vehicle.location.id,
          locationName: vehicle.location.name,
          alerts:       [],
          recipients:   [],
        })
      }
      locationMap.get(vehicle.locationId)!.alerts.push(alert)
    }
  }

  if (locationMap.size === 0) {
    logger.info('[compliance.job] No compliance alerts found — all items current')
    return
  }

  // Fetch OWNER and MANAGER email addresses per location
  for (const [locationId, locationAlert] of locationMap.entries()) {
    const managers = await prisma.user.findMany({
      where: {
        locationId,
        role:      { in: ['OWNER', 'MANAGER'] },
        status:    'ACTIVE',
        deletedAt: null,
      },
      select: { email: true },
    })

    const ownerEmails = await prisma.user.findMany({
      where: { role: 'OWNER', status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    })

    const allRecipients = [
      ...managers.map(u => u.email),
      ...ownerEmails.map(u => u.email),
    ]

    // Merge with ALERT_RECIPIENTS env override
    if (env.ALERT_RECIPIENTS) {
      allRecipients.push(...env.ALERT_RECIPIENTS.split(',').map(e => e.trim()))
    }

    locationAlert.recipients = [...new Set(allRecipients)].filter(Boolean)
  }

  // Send one email per location
  let totalEmailed = 0

  for (const locationAlert of locationMap.values()) {
    if (locationAlert.recipients.length === 0) {
      logger.warn('[compliance.job] No recipients for location — skipping', {
        locationId: locationAlert.locationId,
      })
      continue
    }

    const expiredItems   = locationAlert.alerts.filter(a => a.status === 'EXPIRED')
    const expiringItems  = locationAlert.alerts.filter(a => a.status === 'EXPIRING_SOON')

    const tableRows = locationAlert.alerts
      .sort((a, b) => (a.daysLeft ?? -999) - (b.daysLeft ?? -999))
      .map(alert => {
        const badgeClass = alert.status === 'EXPIRED' ? 'badge-red' : 'badge-yellow'
        const label      = alert.status === 'EXPIRED'
          ? 'EXPIRED'
          : `${alert.daysLeft}d left`
        const expiry = alert.expiryDate
          ? alert.expiryDate.toISOString().split('T')[0]
          : 'No date'

        return `
          <tr>
            <td>${alert.registration}</td>
            <td>${alert.make} ${alert.model}</td>
            <td>${alert.itemType.replace(/_/g, ' ')}</td>
            <td>${expiry}</td>
            <td><span class="badge ${badgeClass}">${label}</span></td>
          </tr>`
      })
      .join('')

    const bodyHtml = `
      <p>
        Daily compliance scan for <strong>${locationAlert.locationName}</strong> found
        <strong>${expiredItems.length} expired</strong> and
        <strong>${expiringItems.length} expiring within ${threshold} days</strong>.
        Vehicles with outstanding compliance issues <strong>cannot be booked</strong>.
      </p>

      <table>
        <thead>
          <tr>
            <th>Registration</th>
            <th>Vehicle</th>
            <th>Item</th>
            <th>Expiry Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <p>Please update the relevant records in RentalOS to restore vehicle compliance.</p>
    `

    await sendEmail({
      to:      locationAlert.recipients,
      subject: `⚠️ [${locationAlert.locationName}] ${locationAlert.alerts.length} Compliance Alert(s) — Action Required`,
      html:    emailTemplate('Compliance Alerts', bodyHtml),
      text:    `${locationAlert.alerts.length} compliance alert(s) for ${locationAlert.locationName}. Log in to RentalOS to review.`,
    })

    totalEmailed++
    logger.info('[compliance.job] Alert sent', {
      location: locationAlert.locationName,
      alerts:   locationAlert.alerts.length,
      expired:  expiredItems.length,
      expiring: expiringItems.length,
    })
  }

  logger.info('[compliance.job] Job complete', {
    locationsAlerted: totalEmailed,
    totalAlerts: [...locationMap.values()].reduce((s, l) => s + l.alerts.length, 0),
  })
}
