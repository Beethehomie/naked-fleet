// ============================================================
// NOTIFICATION SERVICE
// Abstraction over email transport. All jobs route through here.
// Swap the transport (nodemailer → SendGrid / Resend / etc.)
// by editing the single `createTransport` call below.
// ============================================================

import nodemailer, { Transporter } from 'nodemailer'
import { env } from '../config/env'
import { logger } from './logger'

// ── Types ─────────────────────────────────────────────────────

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  /** Optional plain-text fallback */
  text?: string
}

export interface NotificationResult {
  accepted: string[]
  rejected: string[]
  messageId: string
}

// ── Transport singleton ────────────────────────────────────────

let _transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (_transporter) return _transporter

  _transporter = nodemailer.createTransport({
    host:   env.SMTP_HOST,
    port:   env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  })

  return _transporter
}

// ── Core send function ────────────────────────────────────────

export async function sendEmail(payload: EmailPayload): Promise<NotificationResult | null> {
  if (!env.NOTIFICATIONS_ENABLED) {
    logger.info('[notification] NOTIFICATIONS_ENABLED=false — skipping email', {
      to: payload.to,
      subject: payload.subject,
    })
    return null
  }

  try {
    const info = await getTransporter().sendMail({
      from:    `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
      to:      Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
    })

    logger.info('[notification] Email sent', {
      messageId: info.messageId,
      to:        payload.to,
      subject:   payload.subject,
    })

    return {
      accepted:  info.accepted as string[],
      rejected:  info.rejected as string[],
      messageId: info.messageId,
    }
  } catch (err) {
    // Jobs must not crash when email fails — log and continue
    logger.error('[notification] Failed to send email', {
      to:      payload.to,
      subject: payload.subject,
      error:   (err as Error).message,
    })
    return null
  }
}

// ── Template helpers ──────────────────────────────────────────

/**
 * Minimal branded wrapper. All job templates use this so
 * styling is consistent and lives in one place.
 */
export function emailTemplate(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body        { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f5; margin:0; padding:24px; }
    .card       { background:#fff; border-radius:8px; padding:32px; max-width:600px; margin:0 auto; box-shadow:0 1px 4px rgba(0,0,0,.08); }
    .header     { border-bottom:2px solid #1a56db; padding-bottom:16px; margin-bottom:24px; }
    .header h1  { margin:0; font-size:18px; color:#1a56db; }
    .footer     { margin-top:32px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:12px; color:#6b7280; }
    table       { width:100%; border-collapse:collapse; margin:16px 0; }
    th          { background:#f9fafb; text-align:left; padding:8px 12px; font-size:13px; color:#374151; border:1px solid #e5e7eb; }
    td          { padding:8px 12px; font-size:13px; color:#111827; border:1px solid #e5e7eb; }
    .badge      { display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; }
    .badge-red  { background:#fee2e2; color:#991b1b; }
    .badge-yellow { background:#fef9c3; color:#854d0e; }
    .badge-green  { background:#dcfce7; color:#166534; }
    .badge-blue   { background:#dbeafe; color:#1e40af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>🚗 RentalOS — ${title}</h1></div>
    ${bodyHtml}
    <div class="footer">
      This is an automated alert from RentalOS. Do not reply to this email.
    </div>
  </div>
</body>
</html>
`
}
