import { Request, Response, NextFunction } from 'express'
import * as authService from './auth.service'
import { loginSchema, refreshSchema } from './auth.schema'

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input  = loginSchema.parse(req.body)
    const tokens = await authService.login(input)
    return res.status(200).json({ success: true, data: tokens })
  } catch (err) { next(err) }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body)
    const tokens = await authService.refresh(refreshToken)
    return res.status(200).json({ success: true, data: tokens })
  } catch (err) { next(err) }
}

export async function getMeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user.id)
    return res.status(200).json({ success: true, data: user })
  } catch (err) { next(err) }
}
