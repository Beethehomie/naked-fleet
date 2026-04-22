// ============================================================
// JOB SCHEDULER
// Central cron registry. Called once at server startup.
// All jobs are wrapped with:
//   - Error boundary (job failure never crashes the API)
//   - Duration logging
//   - Individual enable/disable via env flags
//
// Cron syntax: second minute hour dom month dow
// Using standard 5-field format (no seconds field).
// All times are in the server's local timezone (UTC on Railway).
// ============================================================

import cron from 'node-cron'
import { logger } from '../shared/logger'

// Jobs
import { runComplianceExpiryJob }           from './compliance.job'
import { runUnresolvedDepositJob }           from './deposits.job'
import { runOverdueBookingsJob, runUpcomingBookingReminderJob } from './bookings.job'
import { runMonthlySupplierFeeReminderJob, runExpiringContractJob } from './suppliers.job'

// ── Job wrapper ────────────────────────────────────────────────

/**
 * Wraps a job function with error-boundary + duration logging.
 * If the job throws, it logs the error and continues — the API
 * process must never crash due to a background job failure.
 */
function safeJob(name: string, fn: () => Promise<void>): () => void {
  return () => {
    const start = Date.now()
    logger.info(`[scheduler] Starting job: ${name}`)

    fn()
      .then(() => {
        logger.info(`[scheduler] Job complete: ${name}`, {
          durationMs: Date.now() - start,
        })
      })
      .catch((err: unknown) => {
        logger.error(`[scheduler] Job failed: ${name}`, {
          error:      (err as Error).message,
          durationMs: Date.now() - start,
        })
      })
  }
}

// ── Schedule registry ──────────────────────────────────────────

interface JobDefinition {
  name:       string
  schedule:   string   // 5-field cron expression
  fn:         () => Promise<void>
  enabled:    boolean
}

const JOBS: JobDefinition[] = [
  {
    name:    'compliance-expiry',
    // Daily at 06:00 UTC
    schedule: '0 6 * * *',
    fn:      runComplianceExpiryJob,
    enabled: true,
  },
  {
    name:    'unresolved-deposits',
    // Daily at 07:00 UTC
    schedule: '0 7 * * *',
    fn:      runUnresolvedDepositJob,
    enabled: true,
  },
  {
    name:    'overdue-bookings',
    // Daily at 07:30 UTC
    schedule: '30 7 * * *',
    fn:      runOverdueBookingsJob,
    enabled: true,
  },
  {
    name:    'upcoming-booking-reminders',
    // Daily at 08:00 UTC (staff are at work, ready to act on reminders)
    schedule: '0 8 * * *',
    fn:      runUpcomingBookingReminderJob,
    enabled: true,
  },
  {
    name:    'expiring-supplier-contracts',
    // Daily at 08:30 UTC
    schedule: '30 8 * * *',
    fn:      runExpiringContractJob,
    enabled: true,
  },
  {
    name:    'monthly-supplier-fee-reminder',
    // 1st of every month at 06:00 UTC
    schedule: '0 6 1 * *',
    fn:      runMonthlySupplierFeeReminderJob,
    enabled: true,
  },
]

// ── Bootstrap ──────────────────────────────────────────────────

/**
 * Register all cron jobs. Call this once in your server entry point
 * AFTER the Express server is listening.
 *
 * Example:
 *   import { startScheduler } from './jobs/scheduler'
 *   startScheduler()
 */
export function startScheduler(): void {
  logger.info('[scheduler] Registering jobs...')

  let registered = 0

  for (const job of JOBS) {
    if (!job.enabled) {
      logger.warn(`[scheduler] Job disabled — skipping: ${job.name}`)
      continue
    }

    if (!cron.validate(job.schedule)) {
      logger.error(`[scheduler] Invalid cron expression for job: ${job.name}`, {
        schedule: job.schedule,
      })
      continue
    }

    cron.schedule(job.schedule, safeJob(job.name, job.fn), {
      timezone: 'UTC',
    })

    logger.info(`[scheduler] Registered: ${job.name}`, { schedule: job.schedule })
    registered++
  }

  logger.info(`[scheduler] ${registered}/${JOBS.length} job(s) registered`)
}

// ── Manual trigger (admin/dev use) ────────────────────────────

/**
 * Run a specific job immediately by name.
 * Useful for manual triggering via an admin endpoint or a CLI script.
 */
export async function triggerJob(name: string): Promise<{ success: boolean; message: string }> {
  const job = JOBS.find(j => j.name === name)

  if (!job) {
    return { success: false, message: `Job not found: ${name}` }
  }

  logger.info(`[scheduler] Manual trigger: ${name}`)

  try {
    await job.fn()
    return { success: true, message: `Job "${name}" completed successfully` }
  } catch (err) {
    const message = (err as Error).message
    logger.error(`[scheduler] Manual trigger failed: ${name}`, { error: message })
    return { success: false, message }
  }
}

/**
 * Returns a list of all registered jobs and their schedules.
 * Used by the admin endpoint GET /api/v1/admin/jobs.
 */
export function listJobs(): Array<{ name: string; schedule: string; enabled: boolean }> {
  return JOBS.map(({ name, schedule, enabled }) => ({ name, schedule, enabled }))
}
