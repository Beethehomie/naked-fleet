# Billing & Deposit Module

## Files

| File | Purpose |
|------|---------|
| `billing.schema.ts` | Zod validation for all request bodies |
| `billing.service.ts` | Payment creation, booking financial tracking |
| `deposit.service.ts` | Deposit lifecycle — HELD → REFUNDED/FORFEITED |
| `refund.service.ts` | Refund reads and listing |
| `billing.controller.ts` | HTTP layer — parse, call service, respond |
| `billing.routes.ts` | Route definitions with RBAC per endpoint |

## Business Rules

1. **Deposit ≠ Revenue** — Deposit is created with status `HELD`. It never enters the revenue ledger until explicitly forfeited or a DAMAGE_CHARGE payment is recorded.
2. **One deposit per booking** — Enforced at both the DB level (`@unique bookingId`) and service level.
3. **Deposit decision requires COMPLETED booking** — The `processDepositRefund` service guard prevents releasing a deposit before the vehicle is returned.
4. **Deduction requires reason** — Validated at schema level: `deductionAmount > 0` requires `deductionReason`.
5. **All operations are atomic** — Payment + deposit creation, and refund + deposit status update, are wrapped in Prisma transactions.
6. **Every state change is audited** — All service methods write to `AuditLog` via `auditService`.

## API Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/billing/collect` | AGENT+ | Collect rental fee + deposit |
| POST | `/billing/payments` | AGENT+ | Ad-hoc payment (extension, damage) |
| GET | `/billing/payments` | FINANCE+ | List all payments |
| GET | `/billing/bookings/:id/payments` | AGENT+ | Payments for a booking |
| GET | `/billing/bookings/:id/summary` | AGENT+ | Financial summary for a booking |
| GET | `/billing/deposits` | FINANCE+ | List all deposits (liability ledger) |
| GET | `/billing/deposits/liability-summary` | FINANCE+ | Dashboard liability totals |
| GET | `/billing/deposits/:id` | FINANCE+ | Single deposit |
| GET | `/billing/bookings/:id/deposit` | AGENT+ | Deposit for a booking |
| POST | `/billing/deposits/:id/refund` | MANAGER+ | Process refund decision |
| GET | `/billing/refunds` | FINANCE+ | List all refunds |
| GET | `/billing/refunds/:id` | FINANCE+ | Single refund |
