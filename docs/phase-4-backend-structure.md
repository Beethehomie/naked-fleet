# RENTAL OS — PHASE 4: BACKEND STRUCTURE
## Folder structure, service layer, API routes, middleware, and auth system

---

## 1. MONOREPO FOLDER STRUCTURE (GitHub-ready)

```
rental-os/
│
├── apps/
│   ├── api/                          ← Node.js / TypeScript backend
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── env.ts            ← Validated env vars (zod)
│   │   │   │   ├── constants.ts      ← App-wide constants
│   │   │   │   └── database.ts       ← Prisma client singleton
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── rbac.middleware.ts
│   │   │   │   ├── validate.middleware.ts
│   │   │   │   ├── rateLimiter.middleware.ts
│   │   │   │   ├── logger.middleware.ts
│   │   │   │   └── errorHandler.middleware.ts
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.routes.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   └── auth.schema.ts
│   │   │   │   │
│   │   │   │   ├── users/
│   │   │   │   │   ├── users.routes.ts
│   │   │   │   │   ├── users.controller.ts
│   │   │   │   │   ├── users.service.ts
│   │   │   │   │   └── users.schema.ts
│   │   │   │   │
│   │   │   │   ├── customers/
│   │   │   │   │   ├── customers.routes.ts
│   │   │   │   │   ├── customers.controller.ts
│   │   │   │   │   ├── customers.service.ts
│   │   │   │   │   └── customers.schema.ts
│   │   │   │   │
│   │   │   │   ├── vehicles/
│   │   │   │   │   ├── vehicles.routes.ts
│   │   │   │   │   ├── vehicles.controller.ts
│   │   │   │   │   ├── vehicles.service.ts
│   │   │   │   │   └── vehicles.schema.ts
│   │   │   │   │
│   │   │   │   ├── bookings/
│   │   │   │   │   ├── bookings.routes.ts
│   │   │   │   │   ├── bookings.controller.ts
│   │   │   │   │   ├── bookings.service.ts
│   │   │   │   │   └── bookings.schema.ts
│   │   │   │   │
│   │   │   │   ├── billing/
│   │   │   │   │   ├── billing.routes.ts
│   │   │   │   │   ├── billing.controller.ts
│   │   │   │   │   ├── billing.service.ts
│   │   │   │   │   ├── deposit.service.ts
│   │   │   │   │   ├── refund.service.ts
│   │   │   │   │   └── billing.schema.ts
│   │   │   │   │
│   │   │   │   ├── inspections/
│   │   │   │   │   ├── inspections.routes.ts
│   │   │   │   │   ├── inspections.controller.ts
│   │   │   │   │   ├── inspections.service.ts
│   │   │   │   │   └── inspections.schema.ts
│   │   │   │   │
│   │   │   │   ├── suppliers/
│   │   │   │   │   ├── suppliers.routes.ts
│   │   │   │   │   ├── suppliers.controller.ts
│   │   │   │   │   ├── suppliers.service.ts
│   │   │   │   │   └── suppliers.schema.ts
│   │   │   │   │
│   │   │   │   ├── claims/
│   │   │   │   │   ├── claims.routes.ts
│   │   │   │   │   ├── claims.controller.ts
│   │   │   │   │   ├── claims.service.ts
│   │   │   │   │   └── claims.schema.ts
│   │   │   │   │
│   │   │   │   ├── compliance/
│   │   │   │   │   ├── compliance.routes.ts
│   │   │   │   │   ├── compliance.controller.ts
│   │   │   │   │   ├── compliance.service.ts
│   │   │   │   │   └── compliance.schema.ts
│   │   │   │   │
│   │   │   │   ├── documents/
│   │   │   │   │   ├── documents.routes.ts
│   │   │   │   │   ├── documents.controller.ts
│   │   │   │   │   ├── documents.service.ts
│   │   │   │   │   └── documents.schema.ts
│   │   │   │   │
│   │   │   │   ├── reports/
│   │   │   │   │   ├── reports.routes.ts
│   │   │   │   │   ├── reports.controller.ts
│   │   │   │   │   └── reports.service.ts
│   │   │   │   │
│   │   │   │   └── locations/
│   │   │   │       ├── locations.routes.ts
│   │   │   │       ├── locations.controller.ts
│   │   │   │       ├── locations.service.ts
│   │   │   │       └── locations.schema.ts
│   │   │   │
│   │   │   ├── shared/
│   │   │   │   ├── audit.service.ts      ← AuditLog writer
│   │   │   │   ├── storage.service.ts    ← Cloud file upload
│   │   │   │   ├── notification.service.ts ← Email/SMS dispatch
│   │   │   │   ├── pagination.ts         ← Reusable paginator
│   │   │   │   └── errors.ts             ← Custom error classes
│   │   │   │
│   │   │   ├── automation/
│   │   │   │   ├── scheduler.ts          ← Cron-based triggers
│   │   │   │   ├── events.ts             ← In-process event bus
│   │   │   │   └── handlers/
│   │   │   │       ├── depositExpiry.handler.ts
│   │   │   │       ├── complianceExpiry.handler.ts
│   │   │   │       └── bookingReminder.handler.ts
│   │   │   │
│   │   │   ├── app.ts                    ← Express app setup
│   │   │   └── server.ts                 ← HTTP server entry point
│   │   │
│   │   ├── prisma/                       ← Symlinked from /prisma root
│   │   ├── .env.example
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                              ← Next.js frontend (Phase frontend)
│       ├── src/
│       │   ├── app/                      ← App router
│       │   ├── components/
│       │   ├── lib/
│       │   └── types/
│       ├── .env.example
│       └── package.json
│
├── prisma/
│   ├── schema.prisma                     ← Single source of truth
│   ├── migrations/
│   └── seed.ts                           ← Dev seed data
│
├── packages/
│   ├── types/                            ← Shared TypeScript types
│   │   ├── src/
│   │   │   ├── booking.types.ts
│   │   │   ├── vehicle.types.ts
│   │   │   ├── billing.types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── utils/                            ← Shared utilities
│       ├── src/
│       │   ├── formatCurrency.ts
│       │   ├── generateRef.ts
│       │   ├── dateHelpers.ts
│       │   └── index.ts
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml                        ← Lint + test on PR
│       └── deploy.yml                    ← Deploy to Railway on main push
│
├── railway.toml                          ← Railway deployment config
├── .gitignore
├── turbo.json                            ← Turborepo config (monorepo build)
└── package.json                          ← Root workspace config
```

---

## 2. SERVICE LAYER BREAKDOWN

Each module follows the same 4-layer pattern. No business logic ever lives in a controller or route file.

```
Route File         → Defines HTTP path + method, applies middleware
Controller File    → Parses request, calls service, returns response
Service File       → All business logic, DB calls via Prisma
Schema File        → Zod validation schemas for request bodies
```

### Pattern Example (Billing Module)

```typescript
// billing.routes.ts — ONLY routing concerns
router.post('/payments',     authenticate, authorize('AGENT','MANAGER','OWNER'), createPayment)
router.post('/deposits/:id/refund', authenticate, authorize('MANAGER','OWNER','FINANCE'), processRefund)
router.get('/deposits',      authenticate, authorize('FINANCE','MANAGER','OWNER'), listDeposits)

// billing.controller.ts — ONLY request/response concerns
async function createPayment(req: Request, res: Response) {
  const data = createPaymentSchema.parse(req.body)  // validate
  const result = await billingService.createPayment(data, req.user)
  return res.status(201).json({ success: true, data: result })
}

// billing.service.ts — ALL business logic
async function createPayment(data: CreatePaymentDto, actor: AuthUser) {
  // 1. Validate booking exists and is in correct state
  // 2. Determine payment type
  // 3. Write Payment record
  // 4. If DEPOSIT type → write Deposit record (status=HELD)
  // 5. Update Booking.amountPaid and outstandingBalance
  // 6. Write AuditLog
  // 7. Trigger notification if fully paid
}
```

### Service Dependency Map

```
billingService
  └── uses: prisma, auditService, notificationService

bookingService
  └── uses: prisma, billingService, vehicleService, auditService

inspectionService
  └── uses: prisma, auditService, storageService, claimService

vehicleService
  └── uses: prisma, auditService

depositService        ← sub-service of billing
  └── uses: prisma, auditService, refundService

refundService         ← sub-service of billing
  └── uses: prisma, auditService, notificationService

claimService
  └── uses: prisma, auditService, documentService, vehicleService

complianceService
  └── uses: prisma, auditService, notificationService

reportService
  └── uses: prisma (read-only aggregations)

auditService          ← shared, used by ALL services
  └── uses: prisma

storageService        ← shared
  └── uses: cloud SDK (S3/R2)

notificationService   ← shared
  └── uses: email provider + SMS provider
```

---

## 3. API ROUTE STRUCTURE

All routes versioned under `/api/v1/`. Every route requires authentication unless marked `[public]`.

```
AUTH
──────────────────────────────────────────────
POST   /api/v1/auth/login               [public]
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh             [public]
GET    /api/v1/auth/me

USERS (Staff)
──────────────────────────────────────────────
GET    /api/v1/users                    [OWNER, MANAGER]
POST   /api/v1/users                    [OWNER]
GET    /api/v1/users/:id                [OWNER, MANAGER]
PUT    /api/v1/users/:id                [OWNER]
DELETE /api/v1/users/:id                [OWNER]  ← soft delete

LOCATIONS
──────────────────────────────────────────────
GET    /api/v1/locations                [ALL]
POST   /api/v1/locations                [OWNER]
PUT    /api/v1/locations/:id            [OWNER]

CUSTOMERS
──────────────────────────────────────────────
GET    /api/v1/customers                [ALL]
POST   /api/v1/customers                [ALL]
GET    /api/v1/customers/:id            [ALL]
PUT    /api/v1/customers/:id            [AGENT, MANAGER, OWNER]
GET    /api/v1/customers/:id/bookings   [ALL]
GET    /api/v1/customers/:id/documents  [MANAGER, OWNER]
POST   /api/v1/customers/:id/blacklist  [MANAGER, OWNER]

VEHICLES (Fleet)
──────────────────────────────────────────────
GET    /api/v1/vehicles                 [ALL]
POST   /api/v1/vehicles                 [MANAGER, OWNER]
GET    /api/v1/vehicles/:id             [ALL]
PUT    /api/v1/vehicles/:id             [MANAGER, OWNER]
DELETE /api/v1/vehicles/:id             [OWNER]   ← soft delete
GET    /api/v1/vehicles/available       [ALL]     ← availability check with dates
GET    /api/v1/vehicles/:id/bookings    [MANAGER, OWNER]
GET    /api/v1/vehicles/:id/costs       [MANAGER, FINANCE, OWNER]
POST   /api/v1/vehicles/:id/costs       [MANAGER, OWNER]
GET    /api/v1/vehicles/:id/compliance  [ALL]
GET    /api/v1/vehicles/:id/profitability [FINANCE, OWNER]

BOOKINGS
──────────────────────────────────────────────
GET    /api/v1/bookings                 [ALL]
POST   /api/v1/bookings                 [AGENT, MANAGER, OWNER]
GET    /api/v1/bookings/:id             [ALL]
PUT    /api/v1/bookings/:id             [MANAGER, OWNER]
POST   /api/v1/bookings/:id/confirm     [MANAGER, OWNER]
POST   /api/v1/bookings/:id/cancel      [MANAGER, OWNER]
POST   /api/v1/bookings/:id/checkout    [AGENT, MANAGER, OWNER]
POST   /api/v1/bookings/:id/checkin     [AGENT, MANAGER, OWNER]

BILLING
──────────────────────────────────────────────
GET    /api/v1/bookings/:id/payments    [ALL]
POST   /api/v1/bookings/:id/payments    [AGENT, MANAGER, OWNER]
GET    /api/v1/deposits                 [FINANCE, MANAGER, OWNER]
GET    /api/v1/deposits/:id             [FINANCE, MANAGER, OWNER]
POST   /api/v1/deposits/:id/refund      [MANAGER, FINANCE, OWNER]
GET    /api/v1/refunds                  [FINANCE, MANAGER, OWNER]

INSPECTIONS
──────────────────────────────────────────────
GET    /api/v1/bookings/:id/inspections [ALL]
POST   /api/v1/inspections              [AGENT, MANAGER, OWNER]
GET    /api/v1/inspections/:id          [ALL]
POST   /api/v1/inspections/:id/damage   [AGENT, MANAGER, OWNER]

SUPPLIERS
──────────────────────────────────────────────
GET    /api/v1/suppliers                [MANAGER, OWNER]
POST   /api/v1/suppliers                [OWNER]
GET    /api/v1/suppliers/:id            [MANAGER, OWNER]
PUT    /api/v1/suppliers/:id            [OWNER]
GET    /api/v1/suppliers/:id/contracts  [MANAGER, OWNER]
POST   /api/v1/suppliers/:id/contracts  [OWNER]

CLAIMS
──────────────────────────────────────────────
GET    /api/v1/claims                   [MANAGER, FINANCE, OWNER]
POST   /api/v1/claims                   [MANAGER, OWNER]
GET    /api/v1/claims/:id               [MANAGER, FINANCE, OWNER]
PUT    /api/v1/claims/:id               [MANAGER, OWNER]
POST   /api/v1/claims/:id/close         [MANAGER, OWNER]

COMPLIANCE
──────────────────────────────────────────────
GET    /api/v1/compliance               [ALL]
POST   /api/v1/compliance               [MANAGER, OWNER]
GET    /api/v1/compliance/:id           [ALL]
PUT    /api/v1/compliance/:id           [MANAGER, OWNER]
GET    /api/v1/compliance/expiring      [MANAGER, OWNER]  ← items expiring soon

DOCUMENTS
──────────────────────────────────────────────
POST   /api/v1/documents/upload         [ALL]      ← multipart/form-data
GET    /api/v1/documents/:id            [ALL]
DELETE /api/v1/documents/:id            [MANAGER, OWNER]  ← soft delete

REPORTS
──────────────────────────────────────────────
GET    /api/v1/reports/dashboard        [FINANCE, MANAGER, OWNER]
GET    /api/v1/reports/revenue          [FINANCE, OWNER]
GET    /api/v1/reports/deposits         [FINANCE, OWNER]    ← liability ledger
GET    /api/v1/reports/fleet            [MANAGER, OWNER]
GET    /api/v1/reports/vehicles/:id/pnl [FINANCE, OWNER]   ← per-vehicle P&L
GET    /api/v1/reports/bookings         [FINANCE, MANAGER, OWNER]
```

---

## 4. MIDDLEWARE STRUCTURE

Middleware is applied in a strict order. Each layer has one responsibility.

```
Incoming Request
       │
       ▼
┌─────────────────────────────────┐
│  1. logger.middleware.ts        │  Log method, path, IP, timestamp
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  2. rateLimiter.middleware.ts   │  100 req/min per IP (configurable)
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  3. auth.middleware.ts          │  Verify JWT — attach user to req
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  4. rbac.middleware.ts          │  Check user.role against allowed roles
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  5. validate.middleware.ts      │  Parse + validate req.body with Zod
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Route Handler / Controller     │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  6. errorHandler.middleware.ts  │  Catch all errors, return structured JSON
└─────────────────────────────────┘
```

### Middleware Implementations

```typescript
// auth.middleware.ts
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = await prisma.user.findUniqueOrThrow({
      where: { id: payload.userId, deletedAt: null, status: 'ACTIVE' }
    })
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// rbac.middleware.ts
export const authorize = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden — insufficient permissions' })
    }
    next()
  }

// validate.middleware.ts
export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: result.error.flatten().fieldErrors
      })
    }
    req.body = result.data  // replace with parsed + typed data
    next()
  }

// errorHandler.middleware.ts
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code })
  }
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Duplicate record' })
  }
  console.error(err)
  return res.status(500).json({ error: 'Internal server error' })
}
```

### Custom Error Classes

```typescript
// shared/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code: string = 'APP_ERROR'
  ) {
    super(message)
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} not found`, 404, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}
```

---

## 5. AUTH SYSTEM DESIGN

### Strategy: JWT with Refresh Tokens

```
Access Token   → Short-lived (15 minutes)
Refresh Token  → Long-lived (7 days), stored in HttpOnly cookie
```

### Login Flow

```
POST /api/v1/auth/login
  Body: { email, password }
  
  1. Find User by email (status = ACTIVE, deletedAt = null)
  2. Compare password with bcrypt hash
  3. On success:
     a. Generate Access Token (JWT, 15min, payload: { userId, role, locationId })
     b. Generate Refresh Token (JWT, 7d, payload: { userId })
     c. Store refresh token hash in DB (or Redis in future)
     d. Update User.lastLoginAt = now()
     e. Write AuditLog: USER_LOGIN
  4. Return:
     - accessToken in response body
     - refreshToken in HttpOnly cookie (SameSite=Strict)
```

### Token Refresh Flow

```
POST /api/v1/auth/refresh
  Cookie: refreshToken=<token>
  
  1. Verify refresh token signature
  2. Look up stored token hash — confirm it matches
  3. Confirm User is still ACTIVE
  4. Issue new access token (15min)
  5. Optionally rotate refresh token (sliding window)
```

### JWT Payload Structure

```typescript
interface JwtPayload {
  userId:     string      // User.id (cuid)
  role:       UserRole    // OWNER | MANAGER | AGENT | FINANCE
  locationId: string      // Branch scope for data filtering
  iat:        number
  exp:        number
}
```

### RBAC Permission Matrix

```
                    OWNER  MANAGER  AGENT  FINANCE
─────────────────────────────────────────────────
Create users          ✓       ✗       ✗       ✗
Manage all locations  ✓       ✗       ✗       ✗
View all reports      ✓       ✓       ✗       ✓
Create bookings       ✓       ✓       ✓       ✗
Process payments      ✓       ✓       ✓       ✗
Approve refunds       ✓       ✓       ✗       ✓
Blacklist customers   ✓       ✓       ✗       ✗
Manage fleet          ✓       ✓       ✗       ✗
View vehicle P&L      ✓       ✗       ✗       ✓
Manage claims         ✓       ✓       ✗       ✗
Manage compliance     ✓       ✓       ✗       ✗
View deposit ledger   ✓       ✓       ✗       ✓
Manage suppliers      ✓       ✗       ✗       ✗
Delete any record     ✓       ✗       ✗       ✗
```

### Password Security

```typescript
// On user creation
const passwordHash = await bcrypt.hash(plainPassword, 12)

// On login verification
const isValid = await bcrypt.compare(plainPassword, user.passwordHash)
```

### Location Scoping

Agents and Managers see only records from their assigned `locationId`. Owners see all locations.

```typescript
// Applied inside every service function:
const locationFilter = req.user.role === 'OWNER'
  ? {}
  : { locationId: req.user.locationId }

const bookings = await prisma.booking.findMany({
  where: { ...locationFilter, deletedAt: null }
})
```

---

## 6. ENVIRONMENT VARIABLES

```env
# apps/api/.env.example

# Database
DATABASE_URL="postgresql://user:password@host:5432/rental_os"

# Auth
JWT_SECRET="your-256-bit-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:3000"

# Cloud Storage (S3-compatible)
STORAGE_PROVIDER="s3"           # or "r2" or "gcs"
STORAGE_BUCKET="rental-os-docs"
STORAGE_REGION="af-south-1"
STORAGE_ACCESS_KEY=""
STORAGE_SECRET_KEY=""
STORAGE_BASE_URL=""

# Notifications
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY=""
EMAIL_FROM="noreply@yourbusiness.com"

SMS_PROVIDER="twilio"
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM_NUMBER=""

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

---

## 7. APP BOOTSTRAP (app.ts + server.ts)

```typescript
// src/app.ts
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { loggerMiddleware } from './middleware/logger.middleware'
import { rateLimiter } from './middleware/rateLimiter.middleware'
import { errorHandler } from './middleware/errorHandler.middleware'
import { authRouter }       from './modules/auth/auth.routes'
import { usersRouter }      from './modules/users/users.routes'
import { customersRouter }  from './modules/customers/customers.routes'
import { vehiclesRouter }   from './modules/vehicles/vehicles.routes'
import { bookingsRouter }   from './modules/bookings/bookings.routes'
import { billingRouter }    from './modules/billing/billing.routes'
import { inspectionsRouter }from './modules/inspections/inspections.routes'
import { suppliersRouter }  from './modules/suppliers/suppliers.routes'
import { claimsRouter }     from './modules/claims/claims.routes'
import { complianceRouter } from './modules/compliance/compliance.routes'
import { documentsRouter }  from './modules/documents/documents.routes'
import { reportsRouter }    from './modules/reports/reports.routes'
import { locationsRouter }  from './modules/locations/locations.routes'

const app = express()

// Security
app.use(helmet())
app.use(cors({ origin: process.env.ALLOWED_ORIGINS, credentials: true }))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Global middleware
app.use(loggerMiddleware)
app.use(rateLimiter)

// Health check (no auth)
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }))

// Routes
const v1 = '/api/v1'
app.use(`${v1}/auth`,        authRouter)
app.use(`${v1}/users`,       usersRouter)
app.use(`${v1}/locations`,   locationsRouter)
app.use(`${v1}/customers`,   customersRouter)
app.use(`${v1}/vehicles`,    vehiclesRouter)
app.use(`${v1}/bookings`,    bookingsRouter)
app.use(`${v1}/billing`,     billingRouter)
app.use(`${v1}/inspections`, inspectionsRouter)
app.use(`${v1}/suppliers`,   suppliersRouter)
app.use(`${v1}/claims`,      claimsRouter)
app.use(`${v1}/compliance`,  complianceRouter)
app.use(`${v1}/documents`,   documentsRouter)
app.use(`${v1}/reports`,     reportsRouter)

// Global error handler — MUST be last
app.use(errorHandler)

export { app }

// src/server.ts
import { app } from './app'
import { env } from './config/env'

app.listen(env.PORT, () => {
  console.log(`[server] Running on port ${env.PORT} in ${env.NODE_ENV} mode`)
})
```
