import bcrypt        from 'bcryptjs'
import jwt           from 'jsonwebtoken'
import { prisma }    from '../../config/database'
import { env }       from '../../config/env'
import { AppError }  from '../../shared/errors'
import type { LoginInput } from './auth.schema'

export interface TokenPair {
  accessToken:  string
  refreshToken: string
}

export interface JwtPayload {
  id:         string
  email:      string
  role:       string
  locationId: string
}

function signAccess(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions)
}

function signRefresh(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as string,
  } as jwt.SignOptions)
}

export async function login(input: LoginInput): Promise<TokenPair> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  })

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError('Invalid email or password', 401)
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is not active. Please contact your administrator.', 403)
  }

  const payload: JwtPayload = {
    id:         user.id,
    email:      user.email,
    role:       user.role,
    locationId: user.locationId,
  }

  return {
    accessToken:  signAccess(payload),
    refreshToken: signRefresh(payload),
  }
}

export async function refresh(token: string): Promise<TokenPair> {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload

    // Fetch live user to ensure still active
    const user = await prisma.user.findUnique({ where: { id: decoded.id } })

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('Account is no longer active', 401)
    }

    const payload: JwtPayload = {
      id:         user.id,
      email:      user.email,
      role:       user.role,
      locationId: user.locationId,
    }

    return {
      accessToken:  signAccess(payload),
      refreshToken: signRefresh(payload),
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('Invalid or expired refresh token', 401)
  }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id:         true,
      email:      true,
      firstName:  true,
      lastName:   true,
      role:       true,
      status:     true,
      locationId: true,
      location:   { select: { id: true, name: true } },
      createdAt:  true,
    },
  })

  if (!user) throw new AppError('User not found', 404)
  return user
}
