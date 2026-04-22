// ============================================================
// SHARED — AUDIT SERVICE
// Every state change in the system writes here.
// Called by all services — never by controllers.
// ============================================================

import { prisma } from '../config/database'
import { Prisma } from '@prisma/client'

interface AuditEntry {
  userId?:   string
  action:    string   // e.g. 'DEPOSIT_REFUNDED', 'BOOKING_CONFIRMED'
  entity:    string   // table name e.g. 'deposits'
  entityId:  string   // record cuid
  oldValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
  ipAddress?: string
  userAgent?: string
}

export const auditService = {
  async log(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId:    entry.userId,
        action:    entry.action,
        entity:    entry.entity,
        entityId:  entry.entityId,
        oldValues: entry.oldValues ?? undefined,
        newValues: entry.newValues ?? undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    })
  },
}
