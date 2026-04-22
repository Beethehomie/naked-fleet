// ============================================================
// MIDDLEWARE — GLOBAL ERROR HANDLER
// Must be the LAST middleware registered in app.ts.
// Catches all errors thrown from controllers and services.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from '../shared/errors'

export const errorHandler = (
  err:  unknown,
  req:  Request,
  res:  Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // 1. Known application errors (thrown intentionally from services)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error:   err.message,
      code:    err.code,
    })
  }

  // 2. Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error:   'Validation failed',
      code:    'VALIDATION_ERROR',
      issues:  err.flatten().fieldErrors,
    })
  }

  // 3. Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error:   'Record not found',
        code:    'NOT_FOUND',
      })
    }
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[])?.join(', ') ?? 'field'
      return res.status(409).json({
        success: false,
        error:   `A record with this ${fields} already exists`,
        code:    'DUPLICATE',
      })
    }
    if (err.code === 'P2003') {
      return res.status(400).json({
        success: false,
        error:   'Invalid reference — related record does not exist',
        code:    'FOREIGN_KEY_VIOLATION',
      })
    }
  }

  // 4. Unexpected errors — log and return generic response
  console.error('[ErrorHandler] Unhandled error:', err)

  return res.status(500).json({
    success: false,
    error:   'An unexpected error occurred',
    code:    'INTERNAL_SERVER_ERROR',
  })
}
