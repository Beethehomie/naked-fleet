// ============================================================
// MIDDLEWARE — AUTH
// Verifies JWT, attaches user to req.user.
// Rejects expired, tampered, or missing tokens.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/database'
import { env } from '../config/env'

interface JwtPayload {
  userId:     string
  role:       string
  locationId: string
  iat:        number
  exp:        number
}

// Extend Express Request type globally
declare global {
  namespace Express {
    interface Request {
      user: {
        id:         string
        role:       'OWNER' | 'MANAGER' | 'AGENT' | 'FINANCE'
        locationId: string
        email:      string
      }
    }
  }
}

export const authenticate = async (
  req:  Request,
  res:  Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token required' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload

    // Fetch user to ensure they're still active (not suspended/deleted since token was issued)
    const user = await prisma.user.findFirst({
      where: {
        id:        payload.userId,
        deletedAt: null,
        status:    'ACTIVE',
      },
      select: {
        id:         true,
        role:       true,
        locationId: true,
        email:      true,
      },
    })

    if (!user) {
      return res.status(401).json({ success: false, error: 'User account not found or inactive' })
    }

    req.user = user as typeof req.user
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, error: 'Token expired' })
    }
    return res.status(401).json({ success: false, error: 'Invalid token' })
  }
}
