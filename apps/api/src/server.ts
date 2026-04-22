// ============================================================
// SERVER ENTRY POINT
// Bootstraps Express, registers all routes, starts the
// job scheduler, and begins listening on PORT.
// ============================================================

import express, { Request, Response } from 'express'
import cors    from 'cors'
import helmet  from 'helmet'

import { env }    from './config/env'
import { logger } from './shared/logger'
import { errorHandler } from './middleware/errorHandler.middleware'
import { startScheduler } from './jobs/scheduler'

// ── Routers ───────────────────────────────────────────────────
import { authRouter }        from './modules/auth/auth.routes'
import { vehiclesRouter }    from './modules/vehicles/vehicles.routes'
import { bookingsRouter }    from './modules/bookings/bookings.routes'
import { billingRouter }     from './modules/billing/billing.routes'
import { inspectionsRouter } from './modules/inspections/inspections.routes'
import { suppliersRouter }   from './modules/suppliers/suppliers.routes'
import { claimsRouter }      from './modules/claims/claims.routes'
import { complianceRouter }  from './modules/compliance/compliance.routes'
import { reportsRouter }     from './modules/reports/reports.routes'
import { adminRouter }       from './modules/admin/admin.routes'

// ── App setup ─────────────────────────────────────────────────

const app = express()

app.use(helmet())
app.use(cors({
  origin:      env.ALLOWED_ORIGINS.split(',').map(o => o.trim()),
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ──────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status:  'ok',
    version: process.env.npm_package_version ?? '1.0.0',
    uptime:  process.uptime(),
  })
})

// ── API routes ────────────────────────────────────────────────

const v1 = '/api/v1'

app.use(`${v1}/auth`,        authRouter)
app.use(`${v1}/vehicles`,    vehiclesRouter)
app.use(`${v1}/bookings`,    bookingsRouter)
app.use(`${v1}/billing`,     billingRouter)
app.use(`${v1}/inspections`, inspectionsRouter)
app.use(`${v1}/suppliers`,   suppliersRouter)
app.use(`${v1}/claims`,      claimsRouter)
app.use(`${v1}/compliance`,  complianceRouter)
app.use(`${v1}/reports`,     reportsRouter)
app.use(`${v1}/admin`,       adminRouter)

// ── 404 handler ───────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// ── Global error handler ──────────────────────────────────────

app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────

const PORT = env.PORT

const httpServer = app.listen(PORT, () => {
  logger.info(`[server] API listening on port ${PORT}`, {
    env:  env.NODE_ENV,
    port: PORT,
  })

  // Start background job scheduler after server is ready
  startScheduler()
})

// ── Graceful shutdown ─────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info(`[server] ${signal} received — shutting down gracefully`)
  httpServer.close(() => {
    logger.info('[server] HTTP server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

export { app }
