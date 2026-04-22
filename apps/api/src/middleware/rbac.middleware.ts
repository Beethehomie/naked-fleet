// ============================================================
// MIDDLEWARE — RBAC (Role-Based Access Control)
// Applied after authenticate middleware.
// Usage: authorize('MANAGER', 'OWNER')
// ============================================================

import { Request, Response, NextFunction } from 'express'

type UserRole = 'OWNER' | 'MANAGER' | 'AGENT' | 'FINANCE'

export const authorize = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error:   'Forbidden — you do not have permission to perform this action',
        required: roles,
        current:  req.user.role,
      })
    }

    next()
  }
