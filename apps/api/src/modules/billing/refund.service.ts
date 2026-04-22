// ============================================================
// BILLING MODULE — REFUND SERVICE
// Read and list operations for refund records.
// Refunds are CREATED by deposit.service (not here directly).
// ============================================================

import { prisma } from '../../config/database'
import { NotFoundError } from '../../shared/errors'

export const refundService = {

  // ── GET REFUND BY ID ───────────────────────────────────────
  async getRefundById(refundId: string) {
    const refund = await prisma.refund.findFirst({
      where: { id: refundId, deletedAt: null },
      include: {
        deposit: {
          include: {
            booking: {
              select: {
                bookingRef: true,
                customer:   { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
        processedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    })

    if (!refund) throw new NotFoundError('Refund', refundId)
    return refund
  },

  // ── LIST REFUNDS ───────────────────────────────────────────
  async listRefunds({
    page   = 1,
    limit  = 20,
    status,
    from,
    to,
    locationId,
    isOwner,
  }: {
    page?:       number
    limit?:      number
    status?:     string
    from?:       Date
    to?:         Date
    locationId?: string
    isOwner:     boolean
  }) {
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}
      ),
      deposit: {
        booking: {
          locationId: isOwner ? (locationId ?? undefined) : locationId,
          deletedAt:  null,
        },
      },
    }

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          deposit: {
            select: {
              amount: true,
              booking: {
                select: {
                  bookingRef: true,
                  customer:   { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
          processedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.refund.count({ where }),
    ])

    return {
      data: refunds,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  },
}
