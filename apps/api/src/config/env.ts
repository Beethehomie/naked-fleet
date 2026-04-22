// ============================================================
// CONFIG — ENVIRONMENT VARIABLES
// Validated at startup with Zod. App will not start if any
// required variable is missing or malformed.
// ============================================================

import { z } from 'zod'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env from apps/api directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const envSchema = z.object({
  // Server
  NODE_ENV:   z.enum(['development', 'production', 'test']).default('development'),
  PORT:       z.coerce.number().default(3001),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Auth
  JWT_SECRET:              z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN:          z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN:  z.string().default('7d'),

  // Storage
  STORAGE_BUCKET:     z.string().optional(),
  STORAGE_REGION:     z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BASE_URL:   z.string().optional(),

  // Email / SMTP
  SMTP_HOST:          z.string().default('smtp.mailgun.org'),
  SMTP_PORT:          z.coerce.number().default(587),
  SMTP_USER:          z.string().default(''),
  SMTP_PASS:          z.string().default(''),
  EMAIL_FROM_NAME:    z.string().default('RentalOS'),
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@rentalos.app'),

  // Notification feature flag — set to 'false' in dev/test to silence emails
  NOTIFICATIONS_ENABLED: z
    .string()
    .transform(v => v === 'true')
    .default('true'),

  // Automation / scheduler
  /** Comma-separated email addresses that receive all system alert digests */
  ALERT_RECIPIENTS: z.string().default(''),

  /** How many days before expiry a compliance item is considered EXPIRING_SOON */
  COMPLIANCE_THRESHOLD_DAYS: z.coerce.number().default(30),

  /** Days after booking completion before chasing an unresolved deposit */
  DEPOSIT_CHASE_DAYS: z.coerce.number().default(7),

  // SMS (optional — future extension)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN:  z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('[Config] ❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
