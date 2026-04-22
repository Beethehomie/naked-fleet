// ============================================================
// ADMIN ROUTES
// Internal endpoints for managing background jobs.
// Restricted to OWNER only — never expose to external clients.
// ============================================================

import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorize }    from '../../middleware/rbac.middleware'
import { triggerJob, listJobs } from '../../jobs/scheduler'

const router = Router()
router.use(authenticate)
router.use(authorize('OWNER'))

/**
 * GET /api/v1/admin/jobs
 * List all registered background jobs and their cron schedules.
 */
router.get('/jobs', (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, data: listJobs() })
})

/**
 * POST /api/v1/admin/jobs/:name/trigger
 * Manually trigger a background job by name.
 * Runs the job synchronously and returns the result.
 * Useful for testing and ad-hoc execution.
 */
router.post('/jobs/:name/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerJob(req.params.name)
    const status = result.success ? 200 : 404
    return res.status(status).json({ success: result.success, message: result.message })
  } catch (err) { next(err) }
})

export { router as adminRouter }
