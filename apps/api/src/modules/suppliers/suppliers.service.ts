// ============================================================
// SUPPLIERS MODULE — SUPPLIERS SERVICE
//
// Manages external vehicle providers who supply vehicles
// to the rental fleet under monthly fee agreements.
//
// BUSINESS RULES:
//   1. A supplier can provide multiple vehicles
//   2. Each supplier contract tracks one vehicle-supplier relationship
//      (or a general supplier agreement without a specific vehicle)
//   3. Only one ACTIVE contract per vehicle per supplier at a time
//   4. Monthly fees from active contracts are tracked as vehicle costs
//   5. Terminating a contract deactivates it — soft delete only
//   6. Supplier vehicles carry ownershipType = SUPPLIER on the vehicle record
//   7. Removing a supplier does NOT remove their vehicles — vehicles
//      must be independently managed
// ============================================================

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../../config/database'
import { auditService } from '../../shared/audit.service'
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../shared/errors'
import type {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateSupplierContractDto,
  UpdateSupplierContractDto,
  ListSuppliersQuery,
  ListContractsQuery,
} from './suppliers.schema'

export const suppliersService = {

  // ──────────────────────────────────────────────────────────
  // SUPPLIERS
  // ──────────────────────────────────────────────────────────

  // ── CREATE SUPPLIER ─────────────────────────────────────────
  async createSupplier(dto: CreateSupplierDto, actorId: string) {
    // Guard: no duplicate supplier name
    const existing = await prisma.supplier.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' }, deletedAt: null },
    })
    if (existing) {
      throw new ConflictError(`A supplier named "${dto.name}" already exists`)
    }

    const supplier = await prisma.supplier.create({
      data: {
        name:        dto.name,
        contactName: dto.contactName ?? null,
        email:       dto.email       ?? null,
        phone:       dto.phone       ?? null,
        address:     dto.address     ?? null,
        bankName:    dto.bankName    ?? null,
        bankAccount: dto.bankAccount ?? null,
        bankBranch:  dto.bankBranch  ?? null,
        notes:       dto.notes       ?? null,
        status:      'ACTIVE',
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'SUPPLIER_CREATED',
      entity:    'suppliers',
      entityId:  supplier.id,
      newValues: { name: supplier.name, email: supplier.email },
    })

    return supplier
  },

  // ── GET SUPPLIER BY ID ──────────────────────────────────────
  async getSupplierById(supplierId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
      include: {
        vehicles: {
          where:   { deletedAt: null, isActive: true },
          select: {
            id: true, registrationNo: true, make: true,
            model: true, year: true, status: true, dailyRate: true,
          },
          orderBy: { registrationNo: 'asc' },
        },
        supplierContracts: {
          where:   { deletedAt: null },
          orderBy: { startDate: 'desc' },
          include: {
            vehicle: {
              select: { registrationNo: true, make: true, model: true },
            },
          },
        },
        _count: {
          select: {
            vehicles:          { where: { deletedAt: null, isActive: true } },
            supplierContracts: { where: { deletedAt: null, isActive: true } },
          },
        },
      },
    })

    if (!supplier) throw new NotFoundError('Supplier', supplierId)

    // Calculate total monthly commitment to this supplier
    const activeContracts = supplier.supplierContracts.filter((c) => c.isActive)
    const totalMonthlyFee = activeContracts.reduce(
      (sum, c) => sum + Number(c.monthlyFee), 0
    )

    return {
      ...supplier,
      summary: {
        activeVehicles:   supplier._count.vehicles,
        activeContracts:  supplier._count.supplierContracts,
        totalMonthlyFee,
      },
    }
  },

  // ── LIST SUPPLIERS ──────────────────────────────────────────
  async listSuppliers(query: ListSuppliersQuery) {
    const { status, page, limit, search } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name:        { contains: search, mode: 'insensitive' as const } },
              { contactName: { contains: search, mode: 'insensitive' as const } },
              { email:       { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}
      ),
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              vehicles:          { where: { deletedAt: null, isActive: true } },
              supplierContracts: { where: { deletedAt: null, isActive: true } },
            },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ])

    return {
      data: suppliers.map((s) => ({
        ...s,
        activeVehicles:  s._count.vehicles,
        activeContracts: s._count.supplierContracts,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── UPDATE SUPPLIER ─────────────────────────────────────────
  async updateSupplier(supplierId: string, dto: UpdateSupplierDto, actorId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
    })
    if (!supplier) throw new NotFoundError('Supplier', supplierId)

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data:  dto,
    })

    await auditService.log({
      userId:    actorId,
      action:    'SUPPLIER_UPDATED',
      entity:    'suppliers',
      entityId:  supplierId,
      oldValues: { name: supplier.name, email: supplier.email, phone: supplier.phone },
      newValues: dto,
    })

    return updated
  },

  // ── DEACTIVATE SUPPLIER ─────────────────────────────────────
  // Sets status to INACTIVE — does NOT remove vehicles.
  // Active contracts are also deactivated.
  async deactivateSupplier(supplierId: string, actorId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
    })
    if (!supplier) throw new NotFoundError('Supplier', supplierId)
    if (supplier.status === 'INACTIVE') {
      throw new ConflictError('Supplier is already inactive')
    }

    // Check if any of their vehicles are currently RENTED
    const rentedVehicles = await prisma.vehicle.count({
      where: { supplierId, status: 'RENTED', deletedAt: null },
    })
    if (rentedVehicles > 0) {
      throw new ValidationError(
        `Cannot deactivate supplier: ${rentedVehicles} vehicle(s) are currently rented. Complete all active rentals first.`
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: supplierId },
        data:  { status: 'INACTIVE' },
      })
      // Deactivate all active contracts
      await tx.supplierContract.updateMany({
        where: { supplierId, isActive: true, deletedAt: null },
        data:  { isActive: false },
      })
    })

    await auditService.log({
      userId:    actorId,
      action:    'SUPPLIER_DEACTIVATED',
      entity:    'suppliers',
      entityId:  supplierId,
      oldValues: { status: 'ACTIVE' },
      newValues: { status: 'INACTIVE' },
    })

    return { success: true, message: 'Supplier deactivated and all active contracts terminated' }
  },

  // ──────────────────────────────────────────────────────────
  // SUPPLIER CONTRACTS
  // ──────────────────────────────────────────────────────────

  // ── CREATE CONTRACT ─────────────────────────────────────────
  async createContract(dto: CreateSupplierContractDto, actorId: string) {
    // Validate supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: { id: dto.supplierId, deletedAt: null, status: 'ACTIVE' },
    })
    if (!supplier) throw new NotFoundError('Supplier', dto.supplierId)

    // Validate vehicle if provided
    if (dto.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, deletedAt: null },
      })
      if (!vehicle) throw new NotFoundError('Vehicle', dto.vehicleId)

      // Guard: vehicle should not already have an active contract with this supplier
      const existingContract = await prisma.supplierContract.findFirst({
        where: {
          supplierId: dto.supplierId,
          vehicleId:  dto.vehicleId,
          isActive:   true,
          deletedAt:  null,
        },
      })
      if (existingContract) {
        throw new ConflictError(
          `An active contract already exists between this supplier and vehicle. Terminate the existing contract before creating a new one.`
        )
      }

      // Update vehicle's supplierId and ownershipType if not already set
      if (vehicle.ownershipType !== 'SUPPLIER' || vehicle.supplierId !== dto.supplierId) {
        await prisma.vehicle.update({
          where: { id: dto.vehicleId },
          data:  { supplierId: dto.supplierId, ownershipType: 'SUPPLIER' },
        })
      }
    }

    const contract = await prisma.supplierContract.create({
      data: {
        supplierId:  dto.supplierId,
        vehicleId:   dto.vehicleId ?? null,
        startDate:   dto.startDate,
        endDate:     dto.endDate   ?? null,
        monthlyFee:  new Decimal(dto.monthlyFee.toString()),
        terms:       dto.terms       ?? null,
        documentUrl: dto.documentUrl ?? null,
        isActive:    true,
      },
      include: {
        supplier: { select: { name: true } },
        vehicle:  { select: { registrationNo: true, make: true, model: true } },
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'SUPPLIER_CONTRACT_CREATED',
      entity:    'supplier_contracts',
      entityId:  contract.id,
      newValues: {
        supplierId:  dto.supplierId,
        vehicleId:   dto.vehicleId,
        monthlyFee:  dto.monthlyFee,
        startDate:   dto.startDate,
        endDate:     dto.endDate,
      },
    })

    return contract
  },

  // ── GET CONTRACT BY ID ──────────────────────────────────────
  async getContractById(contractId: string) {
    const contract = await prisma.supplierContract.findFirst({
      where: { id: contractId, deletedAt: null },
      include: {
        supplier: true,
        vehicle:  {
          select: {
            id: true, registrationNo: true, make: true,
            model: true, year: true, status: true,
          },
        },
      },
    })
    if (!contract) throw new NotFoundError('Supplier contract', contractId)
    return contract
  },

  // ── LIST CONTRACTS ──────────────────────────────────────────
  async listContracts(query: ListContractsQuery) {
    const { supplierId, vehicleId, isActive, page, limit } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(supplierId !== undefined ? { supplierId }   : {}),
      ...(vehicleId  !== undefined ? { vehicleId }    : {}),
      ...(isActive   !== undefined ? { isActive }     : {}),
    }

    const [contracts, total] = await Promise.all([
      prisma.supplierContract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: {
          supplier: { select: { name: true, contactName: true } },
          vehicle:  { select: { registrationNo: true, make: true, model: true } },
        },
      }),
      prisma.supplierContract.count({ where }),
    ])

    return {
      data: contracts.map((c) => ({
        ...c,
        monthlyFee: Number(c.monthlyFee),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },

  // ── UPDATE CONTRACT ─────────────────────────────────────────
  async updateContract(contractId: string, dto: UpdateSupplierContractDto, actorId: string) {
    const contract = await prisma.supplierContract.findFirst({
      where: { id: contractId, deletedAt: null },
    })
    if (!contract) throw new NotFoundError('Supplier contract', contractId)

    const updated = await prisma.supplierContract.update({
      where: { id: contractId },
      data: {
        ...(dto.endDate    ? { endDate:     dto.endDate }                          : {}),
        ...(dto.monthlyFee ? { monthlyFee:  new Decimal(dto.monthlyFee.toString()) } : {}),
        ...(dto.terms      ? { terms:       dto.terms }                            : {}),
        ...(dto.documentUrl? { documentUrl: dto.documentUrl }                      : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive }               : {}),
      },
      include: {
        supplier: { select: { name: true } },
        vehicle:  { select: { registrationNo: true, make: true, model: true } },
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'SUPPLIER_CONTRACT_UPDATED',
      entity:    'supplier_contracts',
      entityId:  contractId,
      oldValues: {
        monthlyFee: Number(contract.monthlyFee),
        isActive:   contract.isActive,
        endDate:    contract.endDate,
      },
      newValues: dto,
    })

    return updated
  },

  // ── TERMINATE CONTRACT ──────────────────────────────────────
  // Sets isActive = false and stamps the endDate as today.
  async terminateContract(contractId: string, actorId: string) {
    const contract = await prisma.supplierContract.findFirst({
      where:   { id: contractId, deletedAt: null },
      include: { vehicle: true },
    })
    if (!contract) throw new NotFoundError('Supplier contract', contractId)
    if (!contract.isActive) {
      throw new ConflictError('Contract is already terminated')
    }

    const today = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.supplierContract.update({
        where: { id: contractId },
        data: { isActive: false, endDate: today },
      })

      // If vehicle was SUPPLIER-owned via this contract and has no other active contracts,
      // reset its ownershipType to OWNED
      if (contract.vehicleId) {
        const otherActiveContracts = await tx.supplierContract.count({
          where: {
            vehicleId:  contract.vehicleId,
            isActive:   true,
            deletedAt:  null,
            id:         { not: contractId },
          },
        })

        if (otherActiveContracts === 0) {
          await tx.vehicle.update({
            where: { id: contract.vehicleId },
            data:  { supplierId: null, ownershipType: 'OWNED' },
          })
        }
      }
    })

    await auditService.log({
      userId:    actorId,
      action:    'SUPPLIER_CONTRACT_TERMINATED',
      entity:    'supplier_contracts',
      entityId:  contractId,
      oldValues: { isActive: true },
      newValues: { isActive: false, endDate: today },
    })

    return { success: true, message: 'Contract terminated successfully' }
  },

  // ── RECORD MONTHLY FEE PAYMENT ──────────────────────────────
  // Logs the monthly supplier fee as a VehicleCost on the linked vehicle.
  // Called manually or by the automation scheduler each month.
  async recordMonthlyFeePayment(contractId: string, actorId: string, forMonth?: Date) {
    const contract = await prisma.supplierContract.findFirst({
      where:   { id: contractId, isActive: true, deletedAt: null },
      include: { supplier: true, vehicle: true },
    })
    if (!contract) throw new NotFoundError('Active supplier contract', contractId)
    if (!contract.vehicleId) {
      throw new ValidationError(
        'This contract is not linked to a specific vehicle. Cannot record cost against vehicle.'
      )
    }

    const month = forMonth ?? new Date()
    const monthLabel = month.toLocaleString('default', { month: 'long', year: 'numeric' })

    const cost = await prisma.vehicleCost.create({
      data: {
        vehicleId:   contract.vehicleId,
        description: `Supplier fee — ${contract.supplier.name} — ${monthLabel}`,
        amount:      contract.monthlyFee,
        costDate:    month,
        category:    'Lease',
        notes:       `Auto-generated from contract ID: ${contractId}`,
      },
    })

    await auditService.log({
      userId:    actorId,
      action:    'SUPPLIER_FEE_RECORDED',
      entity:    'vehicle_costs',
      entityId:  cost.id,
      newValues: {
        contractId,
        vehicleId:   contract.vehicleId,
        supplierId:  contract.supplierId,
        amount:      Number(contract.monthlyFee),
        month:       monthLabel,
      },
    })

    return cost
  },

  // ── SUPPLIER COST SUMMARY ───────────────────────────────────
  // Total monthly commitments across all active supplier contracts.
  // Useful for owner's financial overview.
  async getSupplierCostSummary() {
    const [activeContracts, totalMonthly, bySupplier] = await Promise.all([
      prisma.supplierContract.count({
        where: { isActive: true, deletedAt: null },
      }),
      prisma.supplierContract.aggregate({
        where: { isActive: true, deletedAt: null },
        _sum:  { monthlyFee: true },
      }),
      prisma.supplierContract.groupBy({
        by:    ['supplierId'],
        where: { isActive: true, deletedAt: null },
        _sum:  { monthlyFee: true },
        _count:{ id: true },
      }),
    ])

    // Enrich with supplier names
    const supplierIds = bySupplier.map((s) => s.supplierId)
    const supplierNames = await prisma.supplier.findMany({
      where:  { id: { in: supplierIds } },
      select: { id: true, name: true },
    })
    const nameMap = Object.fromEntries(supplierNames.map((s) => [s.id, s.name]))

    return {
      totalActiveContracts: activeContracts,
      totalMonthlyCommitment: Number(totalMonthly._sum.monthlyFee ?? 0),
      bySupplier: bySupplier.map((s) => ({
        supplierId:    s.supplierId,
        supplierName:  nameMap[s.supplierId] ?? 'Unknown',
        contractCount: s._count.id,
        monthlyTotal:  Number(s._sum.monthlyFee ?? 0),
      })),
    }
  },

  // ── CONTRACTS EXPIRING SOON ─────────────────────────────────
  // Returns contracts whose endDate falls within the next N days.
  async getExpiringContracts(withinDays = 30) {
    const now   = new Date()
    const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)

    const contracts = await prisma.supplierContract.findMany({
      where: {
        deletedAt: null,
        isActive:  true,
        endDate: {
          gte: now,
          lte: until,
        },
      },
      orderBy: { endDate: 'asc' },
      include: {
        supplier: { select: { name: true, contactName: true, email: true, phone: true } },
        vehicle:  { select: { registrationNo: true, make: true, model: true } },
      },
    })

    return contracts.map((c) => ({
      ...c,
      monthlyFee: Number(c.monthlyFee),
      daysUntilExpiry: c.endDate
        ? Math.ceil((c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }))
  },
}
