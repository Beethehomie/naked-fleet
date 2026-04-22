// ============================================================
// REPORTS MODULE — REPORTS SERVICE
//
// Read-only aggregation layer. All queries use Prisma aggregate
// and groupBy — no raw SQL needed. Data is scoped by location
// for non-owners.
//
// REPORTS PROVIDED:
//   1. Owner Dashboard    — real-time KPI snapshot
//   2. Revenue Report     — income over time, grouped by period
//   3. Deposit Report     — liability ledger with refund breakdown
//   4. Fleet Report       — per-vehicle P&L ranked by profitability
//   5. Bookings Report    — volume and trend analysis
//   6. Customer Report    — top customers, booking frequency
//   7. Expense Report     — costs broken down by category and vehicle
// ============================================================

import { prisma } from '../../config/database'
import type {
  PeriodQuery,
  RevenueReportQuery,
  FleetReportQuery,
  BookingsReportQuery,
  DepositReportQuery,
} from './reports.schema'

// ── HELPERS ───────────────────────────────────────────────────

function locationScope(locationId: string | undefined, isOwner: boolean, queryLocationId?: string) {
  if (isOwner) return queryLocationId ? { locationId: queryLocationId } : {}
  return { locationId }
}

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined
  return {
    ...(from ? { gte: from } : {}),
    ...(to   ? { lte: to }   : {}),
  }
}

// Groups a flat list of dated records into periods (day/week/month)
function buildTimeSeries(
  records: { date: Date; amount: number }[],
  groupBy: 'day' | 'week' | 'month'
): { period: string; total: number }[] {
  const map = new Map<string, number>()

  for (const r of records) {
    let key: string
    const d = new Date(r.date)
    if (groupBy === 'day') {
      key = d.toISOString().slice(0, 10)
    } else if (groupBy === 'week') {
      // ISO week label: YYYY-Www
      const jan4   = new Date(d.getFullYear(), 0, 4)
      const week   = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
      key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    map.set(key, (map.get(key) ?? 0) + r.amount)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, total]) => ({ period, total }))
}

// ── START / END OF CURRENT MONTH ──────────────────────────────
function thisMonth() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  }
}
function lastMonth() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
  }
}

// ═══════════════════════════════════════════════════════════════
export const reportsService = {

  // ── 1. OWNER DASHBOARD ──────────────────────────────────────
  // Single endpoint that powers the main landing screen.
  // Returns all critical KPIs in one call.
  async getOwnerDashboard(actorLocationId: string, isOwner: boolean) {
    const scope   = locationScope(actorLocationId, isOwner)
    const curr    = thisMonth()
    const prev    = lastMonth()

    // ── Revenue ─────────────────────────────────────────────────
    const [revenueCurr, revenuePrev] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          deletedAt:   null,
          status:      'COMPLETED',
          paymentType: { in: ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE'] },
          paidAt:      { gte: curr.from, lte: curr.to },
          booking:     { deletedAt: null, ...scope },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          deletedAt:   null,
          status:      'COMPLETED',
          paymentType: { in: ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE'] },
          paidAt:      { gte: prev.from, lte: prev.to },
          booking:     { deletedAt: null, ...scope },
        },
        _sum: { amount: true },
      }),
    ])

    const revenueThisMonth = Number(revenueCurr._sum.amount ?? 0)
    const revenuePrevMonth = Number(revenuePrev._sum.amount ?? 0)
    const revenueGrowth    = revenuePrevMonth > 0
      ? (((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100).toFixed(1)
      : null

    // ── Bookings ────────────────────────────────────────────────
    const [bookingsCurr, bookingsPrev, activeNow, overdueNow] = await Promise.all([
      prisma.booking.count({
        where: { deletedAt: null, createdAt: { gte: curr.from, lte: curr.to }, ...scope },
      }),
      prisma.booking.count({
        where: { deletedAt: null, createdAt: { gte: prev.from, lte: prev.to }, ...scope },
      }),
      prisma.booking.count({
        where: { deletedAt: null, status: 'ACTIVE', ...scope },
      }),
      prisma.booking.count({
        where: {
          deletedAt: null,
          status:    'ACTIVE',
          endDate:   { lt: new Date() },
          ...scope,
        },
      }),
    ])

    // ── Fleet Status ────────────────────────────────────────────
    const fleetStatus = await prisma.vehicle.groupBy({
      by:    ['status'],
      where: { deletedAt: null, isActive: true, ...scope },
      _count:{ id: true },
    })

    const totalVehicles   = fleetStatus.reduce((s, r) => s + r._count.id, 0)
    const rentedVehicles  = fleetStatus.find((r) => r.status === 'RENTED')?._count.id  ?? 0
    const utilisationRate = totalVehicles > 0
      ? Number(((rentedVehicles / totalVehicles) * 100).toFixed(1))
      : 0

    // ── Deposit Liability ───────────────────────────────────────
    const depositLiability = await prisma.deposit.aggregate({
      where: {
        deletedAt: null,
        status:    'HELD',
        booking:   { deletedAt: null, ...scope },
      },
      _sum:   { amount: true },
      _count: { id: true },
    })

    // ── Costs This Month ────────────────────────────────────────
    const costsThisMonth = await prisma.vehicleCost.aggregate({
      where: {
        deletedAt: null,
        costDate:  { gte: curr.from, lte: curr.to },
        vehicle:   { deletedAt: null, ...scope },
      },
      _sum: { amount: true },
    })

    // ── Compliance Alerts ───────────────────────────────────────
    const [expiredItems, expiringSoonItems] = await Promise.all([
      prisma.complianceItem.count({
        where: {
          deletedAt: null,
          status:    'EXPIRED',
          ...(isOwner ? {} : {
            OR: [
              { vehicle:  { locationId: actorLocationId } },
              { customer: { locationId: actorLocationId } },
            ],
          }),
        },
      }),
      prisma.complianceItem.count({
        where: {
          deletedAt: null,
          status:    'EXPIRING_SOON',
          ...(isOwner ? {} : {
            OR: [
              { vehicle:  { locationId: actorLocationId } },
              { customer: { locationId: actorLocationId } },
            ],
          }),
        },
      }),
    ])

    // ── Open Claims ─────────────────────────────────────────────
    const openClaims = await prisma.claim.count({
      where: {
        deletedAt: null,
        status:    { in: ['OPEN', 'UNDER_REVIEW'] },
        vehicle:   { deletedAt: null, ...scope },
      },
    })

    // ── Net Profit This Month ───────────────────────────────────
    const netProfitThisMonth = revenueThisMonth - Number(costsThisMonth._sum.amount ?? 0)

    // ── Upcoming Bookings (next 7 days) ─────────────────────────
    const upcomingBookings = await prisma.booking.count({
      where: {
        deletedAt: null,
        status:    { in: ['CONFIRMED', 'PENDING'] },
        startDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
        ...scope,
      },
    })

    return {
      period: { month: curr.from.toLocaleString('default', { month: 'long', year: 'numeric' }) },

      revenue: {
        thisMonth:   revenueThisMonth,
        lastMonth:   revenuePrevMonth,
        growth:      revenueGrowth ? `${revenueGrowth}%` : null,
        isPositive:  revenueGrowth ? Number(revenueGrowth) >= 0 : null,
      },

      costs: {
        thisMonth: Number(costsThisMonth._sum.amount ?? 0),
      },

      profitability: {
        netProfitThisMonth,
        isProfit: netProfitThisMonth >= 0,
      },

      bookings: {
        thisMonth:       bookingsCurr,
        lastMonth:       bookingsPrev,
        activeNow,
        overdueNow,
        upcomingNext7Days: upcomingBookings,
      },

      fleet: {
        total:          totalVehicles,
        rented:         rentedVehicles,
        available:      fleetStatus.find((r) => r.status === 'AVAILABLE')?._count.id  ?? 0,
        maintenance:    fleetStatus.find((r) => r.status === 'MAINTENANCE')?._count.id ?? 0,
        damaged:        fleetStatus.find((r) => r.status === 'DAMAGED')?._count.id    ?? 0,
        utilisationRate: `${utilisationRate}%`,
      },

      deposits: {
        totalHeld:  Number(depositLiability._sum.amount ?? 0),
        countHeld:  depositLiability._count.id,
      },

      compliance: {
        expiredItems,
        expiringSoonItems,
        needsAttention: expiredItems + expiringSoonItems,
      },

      claims: { openClaims },
    }
  },

  // ── 2. REVENUE REPORT ────────────────────────────────────────
  async getRevenueReport(query: RevenueReportQuery, actorLocationId: string, isOwner: boolean) {
    const scope = locationScope(actorLocationId, isOwner, query.locationId)
    const range = dateRange(query.from, query.to)

    const [payments, byType, totalCosts] = await Promise.all([
      // All revenue payments in range for time-series
      prisma.payment.findMany({
        where: {
          deletedAt:   null,
          status:      'COMPLETED',
          paymentType: { in: ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE', 'OTHER'] },
          ...(range ? { paidAt: range } : {}),
          booking:     { deletedAt: null, ...scope },
        },
        select: { paidAt: true, amount: true, paymentType: true },
        orderBy:{ paidAt: 'asc' },
      }),

      // Revenue broken down by payment type
      prisma.payment.groupBy({
        by:    ['paymentType'],
        where: {
          deletedAt:   null,
          status:      'COMPLETED',
          paymentType: { in: ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE', 'OTHER'] },
          ...(range ? { paidAt: range } : {}),
          booking:     { deletedAt: null, ...scope },
        },
        _sum:  { amount: true },
        _count:{ id: true },
      }),

      // Total costs in same period for net profit
      prisma.vehicleCost.aggregate({
        where: {
          deletedAt: null,
          ...(range ? { costDate: range } : {}),
          vehicle:   { deletedAt: null, ...scope },
        },
        _sum: { amount: true },
      }),
    ])

    const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0)
    const totalCostAmt = Number(totalCosts._sum.amount ?? 0)
    const grossProfit  = totalRevenue - totalCostAmt

    // Build time series
    const timeSeries = buildTimeSeries(
      payments.map((p) => ({ date: p.paidAt, amount: Number(p.amount) })),
      query.groupBy
    )

    return {
      period: { from: query.from ?? null, to: query.to ?? null, groupBy: query.groupBy },
      summary: {
        totalRevenue,
        totalCosts:   totalCostAmt,
        grossProfit,
        margin:       totalRevenue > 0
          ? `${((grossProfit / totalRevenue) * 100).toFixed(1)}%`
          : '0%',
        transactionCount: payments.length,
      },
      byType: byType.map((t) => ({
        type:   t.paymentType,
        total:  Number(t._sum.amount ?? 0),
        count:  t._count.id,
        share:  totalRevenue > 0
          ? `${((Number(t._sum.amount ?? 0) / totalRevenue) * 100).toFixed(1)}%`
          : '0%',
      })),
      timeSeries,
    }
  },

  // ── 3. DEPOSIT REPORT ────────────────────────────────────────
  // Liability ledger — the most financially critical report.
  async getDepositReport(query: DepositReportQuery, actorLocationId: string, isOwner: boolean) {
    const scope = locationScope(actorLocationId, isOwner, query.locationId)
    const range = dateRange(query.from, query.to)

    const [byStatus, refundBreakdown, forfeited, deposits] = await Promise.all([
      // Totals by deposit status
      prisma.deposit.groupBy({
        by:    ['status'],
        where: {
          deletedAt: null,
          ...(query.status ? { status: query.status } : {}),
          ...(range ? { heldAt: range } : {}),
          booking:   { deletedAt: null, ...scope },
        },
        _sum:  { amount: true },
        _count:{ id: true },
      }),

      // Refund breakdown: deductions vs actual refunds
      prisma.refund.aggregate({
        where: {
          deletedAt: null,
          status:    'PROCESSED',
          deposit: {
            booking: { deletedAt: null, ...scope },
            ...(range ? { heldAt: range } : {}),
          },
        },
        _sum:   { amount: true, deductionAmount: true },
        _count: { id: true },
      }),

      // Total forfeited (retained as revenue)
      prisma.deposit.aggregate({
        where: {
          deletedAt: null,
          status:    'FORFEITED',
          booking:   { deletedAt: null, ...scope },
        },
        _sum: { amount: true },
      }),

      // Recent deposits for detail view
      prisma.deposit.findMany({
        where: {
          deletedAt: null,
          ...(query.status ? { status: query.status } : {}),
          ...(range ? { heldAt: range } : {}),
          booking:   { deletedAt: null, ...scope },
        },
        orderBy: { heldAt: 'desc' },
        take:    50,
        include: {
          booking: {
            select: {
              bookingRef: true,
              customer:   { select: { firstName: true, lastName: true } },
              vehicle:    { select: { registrationNo: true, make: true, model: true } },
              startDate:  true,
              endDate:    true,
            },
          },
          refunds: {
            where: { deletedAt: null },
            select: { amount: true, deductionAmount: true, status: true, refundMethod: true },
          },
        },
      }),
    ])

    const totalHeld      = Number(byStatus.find((s) => s.status === 'HELD')?._sum.amount ?? 0)
    const totalRefunded  = Number(refundBreakdown._sum.amount ?? 0)
    const totalDeducted  = Number(refundBreakdown._sum.deductionAmount ?? 0)
    const totalForfeited = Number(forfeited._sum.amount ?? 0)

    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      liability: {
        currentlyHeld:     totalHeld,
        depositCount:      byStatus.find((s) => s.status === 'HELD')?._count.id ?? 0,
      },
      cashFlow: {
        totalRefunded,
        totalDeducted,    // Damage charges collected from deposits
        totalForfeited,   // Full forfeitures recognised as revenue
        netDepositRevenue: totalDeducted + totalForfeited,
      },
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count:  s._count.id,
        total:  Number(s._sum.amount ?? 0),
      })),
      recentDeposits: deposits.map((d) => ({
        ...d,
        amount: Number(d.amount),
      })),
    }
  },

  // ── 4. FLEET PROFITABILITY REPORT ────────────────────────────
  // Ranks every vehicle by gross profit in the period.
  async getFleetReport(query: FleetReportQuery, actorLocationId: string, isOwner: boolean) {
    const scope = locationScope(actorLocationId, isOwner, query.locationId)
    const range = dateRange(query.from, query.to)

    // Get all active vehicles in scope
    const vehicles = await prisma.vehicle.findMany({
      where: {
        deletedAt: null,
        isActive:  true,
        ...scope,
        ...(query.ownershipType ? { ownershipType: query.ownershipType } : {}),
        ...(query.category      ? { category:      query.category }      : {}),
      },
      select: {
        id: true, registrationNo: true, make: true, model: true,
        year: true, category: true, ownershipType: true,
        dailyRate: true, purchasePrice: true, status: true,
      },
    })

    if (vehicles.length === 0) return { vehicles: [], summary: null, period: query }

    const vehicleIds = vehicles.map((v) => v.id)

    // Revenue per vehicle
    const revenueByVehicle = await prisma.payment.groupBy({
      by:    ['booking'],
      where: {
        deletedAt:   null,
        status:      'COMPLETED',
        paymentType: { in: ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE'] },
        ...(range ? { paidAt: range } : {}),
        booking: {
          vehicleId: { in: vehicleIds },
          deletedAt: null,
        },
      },
      _sum: { amount: true },
    })

    // Flat revenue per vehicleId via raw booking join
    const revenueMap = await prisma.payment.groupBy({
      by: ['bookingId'],
      where: {
        deletedAt:   null,
        status:      'COMPLETED',
        paymentType: { in: ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE'] },
        ...(range ? { paidAt: range } : {}),
      },
      _sum: { amount: true },
    })

    // Booking → vehicle map
    const bookingIds   = revenueMap.map((r) => r.bookingId)
    const bookingVehicleMap = await prisma.booking.findMany({
      where:  { id: { in: bookingIds }, vehicleId: { in: vehicleIds } },
      select: { id: true, vehicleId: true, totalDays: true },
    })
    const bvMap = new Map(bookingVehicleMap.map((b) => [b.id, b]))

    // Aggregate revenue per vehicle
    const vehicleRevenue = new Map<string, number>()
    const vehicleDays    = new Map<string, number>()
    for (const r of revenueMap) {
      const booking = bvMap.get(r.bookingId)
      if (!booking) continue
      const vid = booking.vehicleId
      vehicleRevenue.set(vid, (vehicleRevenue.get(vid) ?? 0) + Number(r._sum.amount ?? 0))
      vehicleDays.set(vid, (vehicleDays.get(vid) ?? 0) + (booking.totalDays ?? 0))
    }

    // Costs per vehicle
    const costsData = await prisma.vehicleCost.groupBy({
      by:    ['vehicleId'],
      where: {
        deletedAt: null,
        vehicleId: { in: vehicleIds },
        ...(range ? { costDate: range } : {}),
      },
      _sum:  { amount: true },
      _count:{ id: true },
    })
    const vehicleCosts = new Map(costsData.map((c) => [c.vehicleId, Number(c._sum.amount ?? 0)]))

    // Booking counts per vehicle
    const bookingCounts = await prisma.booking.groupBy({
      by:    ['vehicleId'],
      where: {
        deletedAt: null,
        vehicleId: { in: vehicleIds },
        status:    'COMPLETED',
        ...(range ? { actualEndDate: range } : {}),
      },
      _count: { id: true },
    })
    const vehicleBookings = new Map(bookingCounts.map((b) => [b.vehicleId, b._count.id]))

    // Build ranked result
    const ranked = vehicles.map((v) => {
      const revenue       = vehicleRevenue.get(v.id) ?? 0
      const costs         = vehicleCosts.get(v.id)   ?? 0
      const grossProfit   = revenue - costs
      const daysRented    = vehicleDays.get(v.id)    ?? 0
      const bookingCount  = vehicleBookings.get(v.id) ?? 0
      const purchasePrice = v.purchasePrice ? Number(v.purchasePrice) : null
      const roi           = purchasePrice && purchasePrice > 0
        ? Number(((grossProfit / purchasePrice) * 100).toFixed(2))
        : null

      return {
        id:             v.id,
        registrationNo: v.registrationNo,
        make:           v.make,
        model:          v.model,
        year:           v.year,
        category:       v.category,
        ownershipType:  v.ownershipType,
        status:         v.status,
        dailyRate:      Number(v.dailyRate),
        revenue,
        costs,
        grossProfit,
        roi,
        daysRented,
        bookingCount,
        revenuePerDay:  daysRented > 0 ? Number((revenue / daysRented).toFixed(2)) : 0,
        isProfit:       grossProfit >= 0,
      }
    })

    // Sort by requested field
    const sortKey = query.sortBy ?? 'profit'
    ranked.sort((a, b) => {
      if (sortKey === 'revenue')     return b.revenue      - a.revenue
      if (sortKey === 'costs')       return b.costs        - a.costs
      if (sortKey === 'utilisation') return b.daysRented   - a.daysRented
      return b.grossProfit - a.grossProfit   // default: profit
    })

    const fleetRevenue = ranked.reduce((s, v) => s + v.revenue, 0)
    const fleetCosts   = ranked.reduce((s, v) => s + v.costs, 0)

    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      summary: {
        vehicleCount:    vehicles.length,
        totalRevenue:    fleetRevenue,
        totalCosts:      fleetCosts,
        totalGrossProfit:fleetRevenue - fleetCosts,
        profitableCount: ranked.filter((v) => v.isProfit).length,
        unprofitableCount:ranked.filter((v) => !v.isProfit).length,
      },
      vehicles: ranked,
    }
  },

  // ── 5. BOOKINGS REPORT ───────────────────────────────────────
  async getBookingsReport(
    query:           BookingsReportQuery,
    actorLocationId: string,
    isOwner:         boolean
  ) {
    const scope = locationScope(actorLocationId, isOwner, query.locationId)
    const range = dateRange(query.from, query.to)

    const [byStatus, bookings, avgDuration] = await Promise.all([
      prisma.booking.groupBy({
        by:    ['status'],
        where: {
          deletedAt: null,
          ...scope,
          ...(range ? { createdAt: range } : {}),
        },
        _count: { id: true },
        _sum:   { totalDays: true, rentalAmount: true },
      }),

      prisma.booking.findMany({
        where: {
          deletedAt: null,
          ...scope,
          ...(query.status ? { status: query.status } : {}),
          ...(range ? { createdAt: range } : {}),
        },
        select: { createdAt: true, rentalAmount: true, status: true, totalDays: true },
        orderBy:{ createdAt: 'asc' },
      }),

      prisma.booking.aggregate({
        where: {
          deletedAt: null,
          status:    'COMPLETED',
          ...scope,
          ...(range ? { actualEndDate: range } : {}),
        },
        _avg: { totalDays: true },
        _sum: { totalDays: true },
      }),
    ])

    const timeSeries = buildTimeSeries(
      bookings.map((b) => ({ date: b.createdAt, amount: 1 })),
      query.groupBy
    )

    const totalBookings  = byStatus.reduce((s, r) => s + r._count.id, 0)
    const completedEntry = byStatus.find((r) => r.status === 'COMPLETED')
    const cancelledEntry = byStatus.find((r) => r.status === 'CANCELLED')
    const cancellationRate = totalBookings > 0
      ? `${(((cancelledEntry?._count.id ?? 0) / totalBookings) * 100).toFixed(1)}%`
      : '0%'

    return {
      period:  { from: query.from ?? null, to: query.to ?? null, groupBy: query.groupBy },
      summary: {
        total:             totalBookings,
        completed:         completedEntry?._count.id ?? 0,
        cancelled:         cancelledEntry?._count.id ?? 0,
        cancellationRate,
        avgDurationDays:   Number((avgDuration._avg.totalDays ?? 0).toFixed(1)),
        totalDaysRented:   avgDuration._sum.totalDays ?? 0,
        totalRentalRevenue:Number(completedEntry?._sum.rentalAmount ?? 0),
      },
      byStatus: byStatus.map((s) => ({
        status:   s.status,
        count:    s._count.id,
        totalDays:s._sum.totalDays ?? 0,
      })),
      timeSeries,
    }
  },

  // ── 6. TOP CUSTOMERS REPORT ───────────────────────────────────
  async getTopCustomersReport(
    query:           PeriodQuery,
    actorLocationId: string,
    isOwner:         boolean,
    topN             = 20
  ) {
    const scope = locationScope(actorLocationId, isOwner, query.locationId)
    const range = dateRange(query.from, query.to)

    const bookingStats = await prisma.booking.groupBy({
      by:    ['customerId'],
      where: {
        deletedAt: null,
        status:    'COMPLETED',
        ...scope,
        ...(range ? { actualEndDate: range } : {}),
      },
      _count:{ id: true },
      _sum:  { rentalAmount: true, totalDays: true },
      orderBy:{ _sum: { rentalAmount: 'desc' } },
      take:  topN,
    })

    const customerIds = bookingStats.map((s) => s.customerId)
    const customers   = await prisma.customer.findMany({
      where:  { id: { in: customerIds } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    })
    const customerMap = new Map(customers.map((c) => [c.id, c]))

    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      topCustomers: bookingStats.map((s, i) => ({
        rank:          i + 1,
        customer:      customerMap.get(s.customerId),
        bookingCount:  s._count.id,
        totalSpend:    Number(s._sum.rentalAmount ?? 0),
        totalDays:     s._sum.totalDays ?? 0,
        avgBookingValue: s._count.id > 0
          ? Number((Number(s._sum.rentalAmount ?? 0) / s._count.id).toFixed(2))
          : 0,
      })),
    }
  },

  // ── 7. EXPENSE REPORT ─────────────────────────────────────────
  async getExpenseReport(query: PeriodQuery, actorLocationId: string, isOwner: boolean) {
    const scope = locationScope(actorLocationId, isOwner, query.locationId)
    const range = dateRange(query.from, query.to)

    const [byCategory, total, topCosts] = await Promise.all([
      prisma.vehicleCost.groupBy({
        by:    ['category'],
        where: {
          deletedAt: null,
          ...(range ? { costDate: range } : {}),
          vehicle: { deletedAt: null, ...scope },
        },
        _sum:   { amount: true },
        _count: { id: true },
        orderBy:{ _sum: { amount: 'desc' } },
      }),

      prisma.vehicleCost.aggregate({
        where: {
          deletedAt: null,
          ...(range ? { costDate: range } : {}),
          vehicle: { deletedAt: null, ...scope },
        },
        _sum:   { amount: true },
        _count: { id: true },
      }),

      prisma.vehicleCost.findMany({
        where: {
          deletedAt: null,
          ...(range ? { costDate: range } : {}),
          vehicle: { deletedAt: null, ...scope },
        },
        orderBy: { amount: 'desc' },
        take:    10,
        include: {
          vehicle: { select: { registrationNo: true, make: true, model: true } },
        },
      }),
    ])

    const totalAmount = Number(total._sum.amount ?? 0)

    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      summary: {
        totalExpenses: totalAmount,
        totalEntries:  total._count.id,
      },
      byCategory: byCategory.map((c) => ({
        category:  c.category,
        total:     Number(c._sum.amount ?? 0),
        count:     c._count.id,
        share:     totalAmount > 0
          ? `${((Number(c._sum.amount ?? 0) / totalAmount) * 100).toFixed(1)}%`
          : '0%',
      })),
      topCosts: topCosts.map((c) => ({
        ...c,
        amount: Number(c.amount),
      })),
    }
  },
}
