import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { loginHandler, refreshHandler, getMeHandler } from './auth.controller'

const router = Router()

// POST /api/v1/auth/login
router.post('/login', loginHandler)

// POST /api/v1/auth/refresh
router.post('/refresh', refreshHandler)

// GET /api/v1/auth/me  (requires valid token)
router.get('/me', authenticate, getMeHandler)

export { router as authRouter }
