// ============================================================
// FLEET MODULE — VEHICLES SERVICE
//
// Manages the full vehicle lifecycle:
//   Registration → Active Fleet → Maintenance → Retirement
//
// BUSINESS RULES:
//   1. Status transitions are guarded — cannot freely jump states
//   2. A RENTED or RESERVED vehicle status cannot be manually
//      overridden (must go through booking workflow)
//   3. Cost tracking is per-vehicle for P&L calculation
//   4. P&L = Total Revenue (from completed bookings)
//            - Total Costs (VehicleCost records)
//            - Deposit liability is excluded (not revenue)
//   5. Soft delete only — vehicle history must be preserved
// ============================================================

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../../config/database'
import { auditService } from '../../shared/audit.service'
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  UnprocessableError,
} from '../../shared/errors'
import type {
  CreateVehicleDto,
  UpdateVehicleDto,
  UpdateVehicleStatusDto,
  AddVehicleCostDto,
  ListVehiclesQuery,
  PnlQuery,
} from './vehicles.schema'

// ── STATUS TRANSITION GUARD ────────────────────────────────────
// Defines which transitions are allowed from each status.
// RENTED and RESERVED are controlled by the booking system only.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE:   ['MAINTENANCE', 'DAMAGED', 'RETIRED'],
  MAINTENANCE: ['AVAILABLE', 'DAMAGED', 'RETIRED'],
  DAMAGED:     ['MAINTENANCE', 'AVAILABLE', 'RETIRED'],
  RETIRED:     [],                     // Terminal state — no recovery
  RENTED:      [],                     // Controlled by check-in workflow only
  RESERVED:    [],                     // Controlled by booking workflow only
}

export const vehiclesService = {

  // ── CREATE VEHICLE ─────────────────────────────────────────
  async createVehicle(dto: CreateVehicleDto, actorId: string) {

    // Guard: unique registration number
    const existing = await prisma.vehicle.findFirst({
      where: { registrationNo: dto.registrationNo, deletedAt: null },
    })
    if (existing) {
      throw new ConflictError(
        `A vehicle with registration "${dto.registrationNo}" already exists in the system`
      )
    }

    // Guard: VIN uniqueness (if provided)
    if (dto.vin) {
      const vinExists = await prisma.vehicle.findFirst({
        where: { vin: dto.vin, deletedAt: null },
      })
      if (vinExists) {
        throw new ConflictError(`A vehicle with VIN "${dto.vin}" already exists`)
      }
    }

    // Guard: if SUPPLIER ownership, supplier must exist
    if (dto.ownershipType === 'SUPPLIER' && dto.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: dto.supplierId, deletedAt: null },
      })
      if (!supplier) throw new NotFoundError('Supplier', dto.supplierId)
    }

    // Guard: location must exist and be active
    const location = await prisma.location.findFirst({
      where: { id: dto.locationId, isActive: true, deletedAt: null },
    })
    if (!location) throw new NotFoundError('Location', dto.locationId)

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNo:    dto.registrationNo,
        make:              dto.make,
        model:             dto.model,
        year:              dto.year,
        color:             dto.color,
        vin:               dto.vin ?? null,
        engineNo:          dto.engineNo ?? null,
        fuelType:          dto.fuelType,
        transmission:      dto.transmission,
        category:          dto.category,
        seatingCapacity:   dto.seatingCapacity,
        dailyRate:         new Decimal(dto.dailyRate.toString()),
        depositAmount:     new Decimal(dto.depositAmount.toString()),
        ownershipType:     dto.ownershipType,
        status:            'AVAILABLE',
        mileage:           dto.mileage,
        locationId:        dto.locationId,
        supplierId:        dto.supplierId ?? null,
        purchaseDate:      dto.purchaseDate ?? null,
        purchasePrice:     dto.purchasePrice
                             ? new Decimal(dto.purchasePrice.toString())
                             : null,
        insurancePolicyNo: dto.insurancePolicyNo ?? null,
        notes:             dto.notes ?? null,
        isActive:          true,
      },
      include: {
        location: { select: { name: true, city: true } },
        supplier: { select: { name: true } },
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'VEHICLE_CREATED',
      entity:    'vehicles',
      entityId:  vehicle.id,
      newValues: {
        registrationNo: vehicle.registrationNo,
        make:           vehicle.make,
        model:          vehicle.model,
        ownershipType:  vehicle.ownershipType,
        dailyRate:      dto.dailyRate,
        locationId:     dto.locationId,
      },
    })

    return vehicle
  },

  // ── GET VEHICLE BY ID ──────────────────────────────────────
  async getVehicleById(vehicleId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
      include: {
        location:         { select: { id: true, name: true, city: true } },
        supplier:         { select: { id: true, name: true, contactName: true } },
        insurancePolicies:{ where: { isActive: true, deletedAt: null } },
        complianceItems:  {
          where:   { deletedAt: null },
          orderBy: { expiryDate: 'asc' },
        },
        supplierContracts:{
          where:   { isActive: true, deletedAt: null },
          orderBy: { startDate: 'desc' },
          take:    1,
        },
        _count: {
          select: {
            bookings: { where: { deletedAt: null } },
            claims:   { where: { deletedAt: null } },
          },
        },
      },
    })

    if (!vehicle) throw new NotFoundError('Vehicle', vehicleId)
    return vehicle
  },

  // ── LIST VEHICLES ──────────────────────────────────────────
  async listVehicles(query: ListVehiclesQuery, actorLocationId: string, isOwner: boolean) {
    const { status, ownershipType, locationId, category, supplierId, page, limit } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      isActive:  true,
      ...(status        ? { status }        : {}),
      ...(ownershipType ? { ownershipType } : {}),
      ...(category      ? { category }      : {}),
      ...(supplierId    ? { supplierId }    : {}),
      locationId: isOwner ? (locationId ?? undefined) : actorLocationId,
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          location: { select: { name: true, city: true } },
          supplier: { select: { name: true } },
          _count:   {
            select: {
              bookings: { where: { status: 'ACTIVE', deletedAt: null } },
            },
          },
        },
      }),
      prisma.vehicle.count({ where }),
    ])

    return {
      data: vehicles.map((v) => ({
        ...v,
        dailyRate:     Number(v.dailyRate),
        depositAmount: Number(v.depositAmount),
        purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : null,
        activeBookings: v._count.bookings,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── UPDATE VEHICLE ─────────────────────────────────────────
  async updateVehicle(vehicleId: string, dto: UpdateVehicleDto, actorId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', vehicleId)

    const oldValues = {
      dailyRate:     Number(vehicle.dailyRate),
      depositAmount: Number(vehicle.depositAmount),
      locationId:    vehicle.locationId,
      category:      vehicle.category,
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(dto.make              ? { make: dto.make }                              : {}),
        ...(dto.model             ? { model: dto.model }                            : {}),
        ...(dto.color             ? { color: dto.color }                            : {}),
        ...(dto.category          ? { category: dto.category }                      : {}),
        ...(dto.dailyRate         ? { dailyRate: new Decimal(dto.dailyRate.toString()) } : {}),
        ...(dto.depositAmount     ? { depositAmount: new Decimal(dto.depositAmount.toString()) } : {}),
        ...(dto.locationId        ? { locationId: dto.locationId }                  : {}),
        ...(dto.supplierId        ? { supplierId: dto.supplierId }                  : {}),
        ...(dto.insurancePolicyNo ? { insurancePolicyNo: dto.insurancePolicyNo }    : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes }                          : {}),
        ...(dto.mileage !== undefined ? { mileage: dto.mileage }                    : {}),
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'VEHICLE_UPDATED',
      entity:    'vehicles',
      entityId:  vehicleId,
      oldValues,
      newValues: dto,
    })

    return updated
  },

  // ── UPDATE VEHICLE STATUS ──────────────────────────────────
  // Manual status changes — restricted by transition rules.
  // RENTED and RESERVED cannot be manually changed.
  async updateVehicleStatus(vehicleId: string, dto: UpdateVehicleStatusDto, actorId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', vehicleId)

    // Guard: check transition is allowed
    const allowed = ALLOWED_TRANSITIONS[vehicle.status] ?? []
    if (!allowed.includes(dto.status)) {
      throw new UnprocessableError(
        vehicle.status === 'RENTED' || vehicle.status === 'RESERVED'
          ? `Vehicle status is controlled by the booking system. Current status: ${vehicle.status}`
          : `Cannot transition from ${vehicle.status} to ${dto.status}. Allowed: ${allowed.join(', ') || 'none'}`
      )
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data:  { status: dto.status },
    })

    await auditService.log({
      userId:    actorId,
      action:    'VEHICLE_STATUS_CHANGED',
      entity:    'vehicles',
      entityId:  vehicleId,
      oldValues: { status: vehicle.status },
      newValues: { status: dto.status, reason: dto.reason },
    })

    return updated
  },

  // ── SOFT DELETE (RETIRE) ───────────────────────────────────
  async deleteVehicle(vehicleId: string, actorId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', vehicleId)

    // Cannot delete a vehicle that is actively rented
    if (['RENTED', 'RESERVED'].includes(vehicle.status)) {
      throw new UnprocessableError(
        `Cannot remove a vehicle that is currently ${vehicle.status}. Wait for the booking to complete.`
      )
    }

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data:  { deletedAt: new Date(), isActive: false, status: 'RETIRED' },
    })

    await auditService.log({
      userId:   actorId,
      action:   'VEHICLE_DELETED',
      entity:   'vehicles',
      entityId: vehicleId,
      oldValues: { status: vehicle.status, registrationNo: vehicle.registrationNo },
    })

    return { success: true, message: 'Vehicle retired and removed from active fleet' }
  },

  // ── ADD VEHICLE COST ───────────────────────────────────────
  async addVehicleCost(dto: AddVehicleCostDto, actorId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', dto.vehicleId)

    const cost = await prisma.vehicleCost.create({
      data: {
        vehicleId:   dto.vehicleId,
        description: dto.description,
        amount:      new Decimal(dto.amount.toString()),
        costDate:    dto.costDate,
        category:    dto.category,
        receiptUrl:  dto.receiptUrl ?? null,
        notes:       dto.notes ?? null,
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'VEHICLE_COST_ADDED',
      entity:    'vehicle_costs',
      entityId:  cost.id,
      newValues: {
        vehicleId:   dto.vehicleId,
        description: dto.description,
        amount:      dto.amount,
        category:    dto.category,
        costDate:    dto.costDate,
      },
    })

    return cost
  },

  // ── LIST VEHICLE COSTS ─────────────────────────────────────
  async listVehicleCosts(vehicleId: string, from?: Date, to?: Date) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', vehicleId)

    const costs = await prisma.vehicleCost.findMany({
      where: {
        vehicleId,
        deletedAt: null,
        ...(from || to
          ? { costDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}
        ),
      },
      orderBy: { costDate: 'desc' },
    })

    // Summarise by category
    const summary = costs.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + Number(c.amount)
      return acc
    }, {})

    const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0)

    return {
      costs,
      summary,
      totalCosts,
      count: costs.length,
    }
  },

  // ── VEHICLE P&L (PROFITABILITY) ────────────────────────────
  // Revenue = rental payments from COMPLETED bookings
  //           + damage charges retained from deposit forfeitures
  // Costs   = all VehicleCost records in the period
  // Profit  = Revenue - Costs
  // NOTE:    Deposit itself is EXCLUDED (it's a liability, not revenue)
  async getVehiclePnl(vehicleId: string, query: PnlQuery, actorId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
      select: {
        id: true, registrationNo: true, make: true, model: true,
        year: true, ownershipType: true, purchasePrice: true,
        dailyRate: true, status: true,
      },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', vehicleId)

    const { from, to } = query
    const dateFilter = (from || to)
      ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
      : undefined

    // Revenue from completed bookings
    const revenueData = await prisma.payment.aggregate({
      where: {
        deletedAt:   null,
        status:      'COMPLETED',
        paymentType: { in: ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE'] },
        booking: {
          vehicleId,
          deletedAt: null,
          status:    'COMPLETED',
          ...(dateFilter ? { actualEndDate: dateFilter } : {}),
        },
      },
      _sum:   { amount: true },
      _count: { id: true },
    })

    // Total costs in period
    const costsData = await prisma.vehicleCost.aggregate({
      where: {
        vehicleId,
        deletedAt: null,
        ...(dateFilter ? { costDate: dateFilter } : {}),
      },
      _sum:   { amount: true },
      _count: { id: true },
    })

    // Costs broken down by category
    const costsByCategory = await prisma.vehicleCost.groupBy({
      by:    ['category'],
      where: {
        vehicleId,
        deletedAt: null,
        ...(dateFilter ? { costDate: dateFilter } : {}),
      },
      _sum:   { amount: true },
      _count: { id: true },
    })

    // Booking stats in period
    const bookingStats = await prisma.booking.aggregate({
      where: {
        vehicleId,
        deletedAt: null,
        status:    'COMPLETED',
        ...(dateFilter ? { actualEndDate: dateFilter } : {}),
      },
      _count: { id: true },
      _sum:   { totalDays: true },
    })

    const totalRevenue = Number(revenueData._sum.amount ?? 0)
    const totalCosts   = Number(costsData._sum.amount ?? 0)
    const grossProfit  = totalRevenue - totalCosts
    const purchasePrice= vehicle.purchasePrice ? Number(vehicle.purchasePrice) : null
    const roi          = purchasePrice && purchasePrice > 0
                           ? ((grossProfit / purchasePrice) * 100).toFixed(2)
                           : null

    return {
      vehicle: {
        id:             vehicle.id,
        registrationNo: vehicle.registrationNo,
        make:           vehicle.make,
        model:          vehicle.model,
        year:           vehicle.year,
        ownershipType:  vehicle.ownershipType,
        purchasePrice,
        dailyRate:      Number(vehicle.dailyRate),
        status:         vehicle.status,
      },
      period: { from: from ?? null, to: to ?? null },
      revenue: {
        total:       totalRevenue,
        paymentCount: revenueData._count.id,
      },
      costs: {
        total:       totalCosts,
        count:       costsData._count.id,
        byCategory:  costsByCategory.map((c) => ({
          category: c.category,
          amount:   Number(c._sum.amount ?? 0),
          count:    c._count.id,
        })),
      },
      profitability: {
        grossProfit,
        roi: roi ? `${roi}%` : null,
        isProfit: grossProfit >= 0,
      },
      utilisation: {
        completedBookings: bookingStats._count.id,
        totalDaysRented:   bookingStats._sum.totalDays ?? 0,
      },
    }
  },

  // ── FLEET OVERVIEW DASHBOARD ───────────────────────────────
  // High-level fleet statistics for the owner/manager dashboard
  async getFleetOverview(actorLocationId: string, isOwner: boolean) {
    const locationFilter = isOwner ? {} : { locationId: actorLocationId }

    const [
      statusBreakdown,
      ownershipBreakdown,
      categoryBreakdown,
      totalCostsThisMonth,
      revenueThisMonth,
    ] = await Promise.all([
      // Count by status
      prisma.vehicle.groupBy({
        by:    ['status'],
        where: { deletedAt: null, isActive: true, ...locationFilter },
        _count:{ id: true },
      }),

      // Count by ownership type
      prisma.vehicle.groupBy({
        by:    ['ownershipType'],
        where: { deletedAt: null, isActive: true, ...locationFilter },
        _count:{ id: true },
      }),

      // Count by category
      prisma.vehicle.groupBy({
        by:    ['category'],
        where: { deletedAt: null, isActive: true, ...locationFilter },
        _count:{ id: true },
      }),

      // Fleet costs this calendar month
      prisma.vehicleCost.aggregate({
        where: {
          deletedAt: null,
          costDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lte: new Date(),
          },
          vehicle: { deletedAt: null, ...locationFilter },
        },
        _sum: { amount: true },
      }),

      // Revenue this calendar month from completed bookings
      prisma.payment.aggregate({
        where: {
          deletedAt:   null,
          status:      'COMPLETED',
          paymentType: { in: ['RENTAL_FEE', 'DAMAGE_CHARGE', 'EXTENSION_FEE'] },
          paidAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lte: new Date(),
          },
          booking: { vehicle: { ...locationFilter }, deletedAt: null },
        },
        _sum: { amount: true },
      }),
    ])

    const totalVehicles   = statusBreakdown.reduce((s, r) => s + r._count.id, 0)
    const availableCount  = statusBreakdown.find((r) => r.status === 'AVAILABLE')?._count.id    ?? 0
    const rentedCount     = statusBreakdown.find((r) => r.status === 'RENTED')?._count.id        ?? 0
    const maintenanceCount= statusBreakdown.find((r) => r.status === 'MAINTENANCE')?._count.id   ?? 0
    const damagedCount    = statusBreakdown.find((r) => r.status === 'DAMAGED')?._count.id       ?? 0

    return {
      totals: {
        total:       totalVehicles,
        available:   availableCount,
        rented:      rentedCount,
        maintenance: maintenanceCount,
        damaged:     damagedCount,
        reserved:    statusBreakdown.find((r) => r.status === 'RESERVED')?._count.id ?? 0,
        utilisationRate: totalVehicles > 0
          ? `${((rentedCount / totalVehicles) * 100).toFixed(1)}%`
          : '0%',
      },
      byOwnership: ownershipBreakdown.map((r) => ({
        type: r.ownershipType, count: r._count.id,
      })),
      byCategory: categoryBreakdown.map((r) => ({
        category: r.category, count: r._count.id,
      })),
      financialsThisMonth: {
        revenue:    Number(revenueThisMonth._sum.amount ?? 0),
        costs:      Number(totalCostsThisMonth._sum.amount ?? 0),
        netProfit:  Number(revenueThisMonth._sum.amount ?? 0) - Number(totalCostsThisMonth._sum.amount ?? 0),
      },
    }
  },

  // ── GET VEHICLE BOOKING HISTORY ────────────────────────────
  async getVehicleBookingHistory(vehicleId: string, page = 1, limit = 20) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    })
    if (!vehicle) throw new NotFoundError('Vehicle', vehicleId)

    const skip = (page - 1) * limit

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where:   { vehicleId, deletedAt: null },
        skip,
        take:    limit,
        orderBy: { startDate: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
          deposit:  { select: { status: true, amount: true } },
          payments: {
            where:   { deletedAt: null },
            select:  { amount: true, paymentType: true, status: true },
          },
        },
      }),
      prisma.booking.count({ where: { vehicleId, deletedAt: null } }),
    ])

    return {
      data: bookings,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },
}
