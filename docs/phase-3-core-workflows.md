# RENTAL OS — PHASE 3: CORE WORKFLOWS
## Step-by-step business flows, system triggers, and data updates

---

## WORKFLOW 1 — BOOKING FLOW

### Overview
A booking is the central entity of the system. Everything — payments, deposits, inspections, contracts, and claims — attaches to a booking.

---

### Steps

```
STEP 1: Staff selects or creates a Customer
───────────────────────────────────────────
  Input:   Customer name / ID number / phone
  Action:  Search existing customers by email, phone, or ID
           If not found → create new Customer record
  Checks:  Customer.status must be ACTIVE (not BLACKLISTED)
           Driver's licence must be valid (not expired)
  Trigger: If new customer → AuditLog entry: CUSTOMER_CREATED
  DB:      Customer record confirmed or created

STEP 2: Staff selects booking dates
────────────────────────────────────
  Input:   startDate, endDate, locationId
  Action:  System calculates totalDays = endDate - startDate
  Checks:  startDate must be >= today
           endDate must be > startDate
           totalDays must be >= 1

STEP 3: System checks vehicle availability
───────────────────────────────────────────
  Input:   startDate, endDate, locationId, vehicle category (optional)
  Action:  Query vehicles WHERE:
             status = AVAILABLE OR RESERVED
             locationId = selected location
             No overlapping Booking exists with status IN
             (PENDING, CONFIRMED, ACTIVE) for the same date range
  Returns: List of available vehicles with dailyRate and depositAmount

STEP 4: Staff selects a Vehicle
────────────────────────────────
  Input:   vehicleId
  Action:  Lock vehicle.dailyRate and vehicle.depositAmount
           These are copied to the Booking — NOT referenced live
           (protects against future rate changes)
  DB:      No write yet — values captured in memory

STEP 5: System calculates financials
─────────────────────────────────────
  Calculation:
    rentalAmount   = totalDays × dailyRate
    depositAmount  = vehicle.depositAmount (fixed)
    totalAmount    = rentalAmount + depositAmount
    outstandingBalance = totalAmount (before payment)

STEP 6: Booking record created
───────────────────────────────
  DB Writes:
    Booking {
      bookingRef         = generated (BK-YYYY-NNNN)
      status             = PENDING
      customerId, vehicleId, locationId
      startDate, endDate, totalDays
      dailyRate, rentalAmount, depositAmount, totalAmount
      outstandingBalance = totalAmount
      amountPaid         = 0
      createdById        = current staff user
    }
  Trigger:  AuditLog: BOOKING_CREATED
  Trigger:  Move to Payment Flow (Workflow 2)
```

### State After Workflow 1
```
Booking.status         = PENDING
Vehicle.status         = AVAILABLE (not yet reserved)
Deposit.status         = (not yet created)
Customer.bookings      = +1
```

---

## WORKFLOW 2 — PAYMENT + DEPOSIT FLOW

### Overview
Payment is split into two logical streams: the rental fee (revenue) and the deposit (liability). Both are collected together but tracked separately.

---

### Steps

```
STEP 1: Staff collects payment from customer
──────────────────────────────────────────────
  Input:   amount, paymentMethod, reference (optional)
  Rule:    Full payment required before vehicle is released
           (partial payments may be configured by owner)
  Action:  System validates amount covers at minimum the
           full deposit + a configurable % of rental fee

STEP 2: Rental fee payment recorded
─────────────────────────────────────
  DB Write:
    Payment {
      bookingId
      amount        = rentalAmount
      paymentType   = RENTAL_FEE
      paymentMethod = [CASH | CARD | EFT | BANK_TRANSFER]
      status        = COMPLETED
      processedById = current staff user
      paidAt        = now()
    }
  Trigger: AuditLog: PAYMENT_RECORDED (type=RENTAL_FEE)

STEP 3: Deposit payment recorded
──────────────────────────────────
  DB Write:
    Payment {
      bookingId
      amount        = depositAmount
      paymentType   = DEPOSIT
      paymentMethod = [CASH | CARD | EFT | BANK_TRANSFER]
      status        = COMPLETED
      processedById = current staff user
      paidAt        = now()
    }
  Trigger: AuditLog: PAYMENT_RECORDED (type=DEPOSIT)

STEP 4: Deposit liability record created
─────────────────────────────────────────
  DB Write:
    Deposit {
      bookingId     = booking.id
      amount        = depositAmount
      status        = HELD       ← NEVER revenue until decision made
      heldAt        = now()
    }
  Rule:    Deposit is a LIABILITY. It does NOT appear in revenue.
           It sits on a separate ledger until released.
  Trigger: AuditLog: DEPOSIT_HELD

STEP 5: Booking financials updated
────────────────────────────────────
  DB Update:
    Booking {
      amountPaid         += rentalAmount + depositAmount
      outstandingBalance  = totalAmount - amountPaid
      status              = CONFIRMED (if fully paid)
    }
  Trigger: AuditLog: BOOKING_CONFIRMED
  Trigger: Vehicle allocation (Workflow 3)

STEP 6: Contract generated
───────────────────────────
  DB Write:
    Contract {
      bookingId    = booking.id
      contractRef  = generated (CT-YYYY-NNNN)
      status       = DRAFT
      terms        = standard terms template
    }
  Action:  PDF generated and stored in cloud storage
           Contract.documentUrl updated
  Trigger: AuditLog: CONTRACT_GENERATED
  Next:    Staff presents contract to customer for signature
           On signature → Contract.status = ACTIVE
                          Contract.signedAt = now()
                          Contract.signedByName = customer name
```

### State After Workflow 2
```
Booking.status         = CONFIRMED
Booking.amountPaid     = totalAmount
Booking.outstandingBalance = 0
Payment (RENTAL_FEE)   = COMPLETED  → Revenue ledger
Payment (DEPOSIT)      = COMPLETED  → Liability ledger
Deposit.status         = HELD
Contract.status        = ACTIVE
```

---

## WORKFLOW 3 — VEHICLE ALLOCATION FLOW

### Overview
Once a booking is confirmed and paid, the vehicle is formally reserved. This prevents double-booking.

---

### Steps

```
STEP 1: Confirm booking is CONFIRMED status
────────────────────────────────────────────
  Check:  Booking.status = CONFIRMED
          Booking.outstandingBalance = 0
  Block:  Vehicle cannot be allocated if payment is incomplete

STEP 2: Re-check vehicle availability
───────────────────────────────────────
  Action: Final availability check at allocation time
          Prevents race condition where two agents book
          the same vehicle simultaneously
  Check:  No other CONFIRMED/ACTIVE booking exists for vehicle
          in the same date range
  Fail:   If conflict detected → return error, offer alternatives

STEP 3: Vehicle status updated
───────────────────────────────
  DB Update:
    Vehicle {
      status = RESERVED   ← Removed from availability pool
    }
  Trigger: AuditLog: VEHICLE_RESERVED

STEP 4: Booking confirmed with vehicle
───────────────────────────────────────
  DB Update:
    Booking {
      vehicleId = confirmed vehicle ID
    }
  Trigger: Automation → send confirmation notification to customer
           (email/SMS with booking reference, dates, vehicle details)
```

### State After Workflow 3
```
Vehicle.status  = RESERVED
Booking.status  = CONFIRMED
Booking.vehicleId = locked in
```

---

## WORKFLOW 4 — CHECK-OUT FLOW

### Overview
The moment the customer takes the vehicle. This triggers an inspection, activates the booking, and starts the rental period.

---

### Steps

```
STEP 1: Staff confirms customer identity
─────────────────────────────────────────
  Check:  Customer.driversLicence is present
          Customer.licenceExpiry > today
          Customer.status = ACTIVE
  Block:  Do NOT release vehicle if licence is expired or missing

STEP 2: Staff performs check-out inspection
─────────────────────────────────────────────
  DB Write:
    Inspection {
      bookingId      = booking.id
      vehicleId      = vehicle.id
      type           = CHECK_OUT
      mileageAtTime  = current odometer reading
      fuelLevel      = current fuel % (0–100)
      conductedById  = current staff user
      conductedAt    = now()
      hasDamage      = false (default, updated below)
    }

STEP 3: Staff records any pre-existing damage
──────────────────────────────────────────────
  For each damage found:
    DB Write:
      DamageItem {
        inspectionId  = inspection.id
        location      = "Front bumper" / "Driver door" / etc.
        description   = text description
        severity      = MINOR | MODERATE | MAJOR
        photoUrl      = cloud storage URL
        isPreExisting = true   ← CRITICAL: marks as existing damage
        estimatedCost = optional
      }
  Update:
    Inspection.hasDamage = true (if any items added)
  Rule:    Pre-existing damage CANNOT be charged to the customer
           at check-in. The isPreExisting flag protects them.
  Trigger: AuditLog: INSPECTION_CHECKOUT_COMPLETED

STEP 4: Customer signs inspection report
─────────────────────────────────────────
  DB Update:
    Inspection {
      customerSignature = URL to captured signature image
    }

STEP 5: Vehicle and booking status updated
───────────────────────────────────────────
  DB Update:
    Vehicle {
      status  = RENTED
      mileage = inspection.mileageAtTime (updated odometer)
    }
    Booking {
      status          = ACTIVE
      actualStartDate = now()
    }
  Trigger: AuditLog: BOOKING_ACTIVATED
  Trigger: AuditLog: VEHICLE_STATUS_CHANGED (RESERVED → RENTED)
  Trigger: Automation → start rental period timer
           → alert if booking end date is approaching (T-1 day)
```

### State After Workflow 4
```
Booking.status          = ACTIVE
Booking.actualStartDate = recorded
Vehicle.status          = RENTED
Inspection (CHECK_OUT)  = completed with signature
DamageItems             = pre-existing items logged with isPreExisting=true
```

---

## WORKFLOW 5 — CHECK-IN + INSPECTION FLOW

### Overview
The customer returns the vehicle. A check-in inspection is performed and compared against the check-out inspection. This determines the deposit outcome.

---

### Steps

```
STEP 1: Customer returns vehicle
─────────────────────────────────
  Input:  bookingId, actual return datetime
  Check:  Booking.status = ACTIVE

STEP 2: Staff performs check-in inspection
───────────────────────────────────────────
  DB Write:
    Inspection {
      bookingId      = booking.id
      vehicleId      = vehicle.id
      type           = CHECK_IN
      mileageAtTime  = current odometer reading
      fuelLevel      = current fuel %
      conductedById  = current staff user
      conductedAt    = now()
      hasDamage      = false (default)
    }

STEP 3: Staff compares against check-out inspection
─────────────────────────────────────────────────────
  Action: System displays CHECK_OUT inspection alongside CHECK_IN form
          Staff identifies any NEW damage (not on check-out report)
  Rule:   Only damage where DamageItem.isPreExisting = false
          on the CHECK_IN inspection is chargeable

STEP 4: Staff logs new damage items
─────────────────────────────────────
  For each new damage:
    DB Write:
      DamageItem {
        inspectionId  = CHECK_IN inspection.id
        location      = location description
        description   = description
        severity      = MINOR | MODERATE | MAJOR | TOTALED
        photoUrl      = cloud storage URL
        isPreExisting = false   ← NEW damage, customer is liable
        estimatedCost = estimated repair cost
      }
  Update:
    Inspection.hasDamage = true

STEP 5: Check late return
──────────────────────────
  Check:  Booking.actualEndDate (now()) vs Booking.endDate
  If late:
    extraDays    = actualEndDate - endDate
    extraCharge  = extraDays × Booking.dailyRate
    DB Write:
      Payment {
        paymentType   = EXTENSION_FEE
        amount        = extraCharge
        status        = PENDING  ← Collected now or deducted from deposit
      }
    DB Update:
      Booking.totalAmount    += extraCharge
      Booking.outstandingBalance += extraCharge

STEP 6: Vehicle and booking status updated
───────────────────────────────────────────
  DB Update:
    Vehicle {
      status  = AVAILABLE (or DAMAGED if damage is MAJOR/TOTALED)
      mileage = CHECK_IN mileageAtTime
    }
    Booking {
      status        = COMPLETED
      actualEndDate = now()
    }
  Trigger: AuditLog: BOOKING_COMPLETED
  Trigger: AuditLog: VEHICLE_STATUS_CHANGED
  Next:    Move to Refund Flow (Workflow 6)
           OR Damage/Claim Flow (Workflow 7) if damage found
```

### State After Workflow 5
```
Booking.status         = COMPLETED
Booking.actualEndDate  = recorded
Vehicle.status         = AVAILABLE or DAMAGED
Inspection (CHECK_IN)  = completed
DamageItems            = new damage logged (isPreExisting=false)
```

---

## WORKFLOW 6 — REFUND FLOW

### Overview
After check-in inspection, a decision is made on the deposit. This is one of three outcomes: full refund, partial refund, or full forfeiture.

---

### Decision Matrix

```
┌─────────────────────────────┬──────────────────────────────────────────────┐
│  Inspection Outcome         │  Deposit Decision                            │
├─────────────────────────────┼──────────────────────────────────────────────┤
│  No new damage              │  FULL REFUND — return 100% to customer       │
│  Minor damage (< deposit)   │  PARTIAL REFUND — deduct repair cost         │
│  Major damage (≥ deposit)   │  FORFEIT — retain full deposit + raise claim │
│  Total loss / theft         │  FORFEIT — full deposit retained + claim     │
└─────────────────────────────┴──────────────────────────────────────────────┘
```

---

### Steps — Path A: Full Refund (No Damage)

```
STEP 1: Staff confirms no new damage on CHECK_IN inspection
  Check:  No DamageItems with isPreExisting=false on CHECK_IN inspection

STEP 2: Refund record created
  DB Write:
    Refund {
      depositId       = deposit.id
      amount          = deposit.amount   (100%)
      deductionAmount = 0
      status          = PENDING
      refundMethod    = agreed method (CASH | EFT | etc.)
      reason          = "No damage — full refund"
      processedById   = current staff user
    }

STEP 3: Deposit status updated
  DB Update:
    Deposit {
      status     = REFUNDED
      releasedAt = now()
    }

STEP 4: Refund processed
  DB Update:
    Refund {
      status      = PROCESSED
      processedAt = now()
      reference   = payment reference
    }
  Trigger: AuditLog: DEPOSIT_REFUNDED
  Trigger: Automation → send refund confirmation to customer
```

---

### Steps — Path B: Partial Refund (Minor Damage)

```
STEP 1: Staff confirms damage cost estimate
  Input:  DamageItem.estimatedCost or actualCost
          Total damage cost < deposit.amount

STEP 2: Calculate refund amounts
  deductionAmount = total damage cost
  refundAmount    = deposit.amount - deductionAmount

STEP 3: Refund record created
  DB Write:
    Refund {
      depositId       = deposit.id
      amount          = refundAmount
      deductionAmount = deductionAmount
      deductionReason = "Damage repair: [description]"
      status          = PENDING
      refundMethod    = agreed method
      processedById   = current staff user
    }

STEP 4: Deposit status updated
  DB Update:
    Deposit {
      status     = PARTIALLY_REFUNDED
      releasedAt = now()
    }

STEP 5: Damage income recorded (deducted portion)
  DB Write:
    Payment {
      bookingId     = booking.id
      amount        = deductionAmount
      paymentType   = DAMAGE_CHARGE
      status        = COMPLETED
      notes         = "Deducted from deposit"
    }
  Trigger: AuditLog: DEPOSIT_PARTIALLY_REFUNDED
  Trigger: Move to Damage/Claim Flow for repair tracking
```

---

### Steps — Path C: Full Forfeiture (Major Damage)

```
STEP 1: Staff confirms major/total damage
  Check:  DamageItem.severity = MAJOR or TOTALED

STEP 2: Deposit forfeited
  DB Update:
    Deposit {
      status     = FORFEITED
      releasedAt = now()
      notes      = "Deposit retained — [damage description]"
    }

STEP 3: Damage charge recorded as revenue
  DB Write:
    Payment {
      bookingId   = booking.id
      amount      = deposit.amount
      paymentType = DAMAGE_CHARGE
      status      = COMPLETED
      notes       = "Full deposit forfeited — damage"
    }
  Trigger: AuditLog: DEPOSIT_FORFEITED
  Trigger: Move to Damage/Claim Flow (Workflow 7) immediately
  Trigger: Vehicle.status = DAMAGED
```

### State After Workflow 6
```
Deposit.status  = REFUNDED | PARTIALLY_REFUNDED | FORFEITED
Refund.status   = PROCESSED (Path A, B)
Booking         = financially closed
Revenue ledger  = updated with damage income (if applicable)
```

---

## WORKFLOW 7 — DAMAGE / CLAIM FLOW

### Overview
When damage is found at check-in (or an incident occurs during rental), a claim is raised. This may involve the customer's liability, the company's insurance, or both.

---

### Steps

```
STEP 1: Damage confirmed post-inspection
──────────────────────────────────────────
  Trigger: From Workflow 6 (Path B or C)
           OR: Incident reported during active rental

STEP 2: Claim record created
──────────────────────────────
  DB Write:
    Claim {
      claimRef          = generated (CL-YYYY-NNNN)
      vehicleId         = vehicle.id
      bookingId         = booking.id (if rental-related)
      type              = DAMAGE | THEFT | THIRD_PARTY | WINDSCREEN
      status            = OPEN
      description       = description of incident/damage
      incidentDate      = date of incident
      incidentLocation  = location of incident (if known)
      estimatedCost     = sum of DamageItem.estimatedCost
      managedById       = current staff user
    }
  Trigger: AuditLog: CLAIM_OPENED

STEP 3: Damage items linked to claim
──────────────────────────────────────
  DB Update:
    DamageItem.claimId = claim.id
    (for all relevant damage items from CHECK_IN inspection)

STEP 4: Determine liability split
───────────────────────────────────
  Decision tree:
    a) Damage cost ≤ deposit held:
       → Customer liable → deposit covers cost → no insurance claim needed
    b) Damage cost > deposit:
       → Customer liable up to deposit amount
       → Remainder → insurance claim OR company absorbs
    c) Third-party incident:
       → Insurance claim raised
       → Third party liability assessed
    d) Total loss / theft:
       → Full insurance claim raised immediately

STEP 5: Insurance claim raised (if applicable)
───────────────────────────────────────────────
  Input:  insurancePolicyId (from vehicle's active InsurancePolicy)
  DB Update:
    Claim {
      insurancePolicyId = policy.id
      status            = UNDER_REVIEW
    }
  Action: Supporting documents uploaded to claim
          (inspection report, photos, police report if theft)
  DB Write:
    Document {
      type     = DAMAGE_REPORT | INSPECTION_REPORT
      claimId  = claim.id
      url      = cloud storage URL
    }
  Trigger: AuditLog: CLAIM_SUBMITTED_TO_INSURER

STEP 6: Actual repair costs recorded
──────────────────────────────────────
  DB Update:
    DamageItem.actualCost = confirmed repair amount (per item)
  DB Update:
    Claim.settledAmount   = total confirmed cost
    Claim.excessPaid      = excess paid to insurer

STEP 7: Claim closed
──────────────────────
  DB Update:
    Claim {
      status   = SETTLED | CLOSED
      closedAt = now()
    }
  DB Update:
    Vehicle.status = AVAILABLE (once repaired)
    VehicleCost {
      vehicleId   = vehicle.id
      description = "Damage repair — [claim ref]"
      amount      = claim.settledAmount
      category    = "Maintenance"
      costDate    = now()
    }
  Trigger: AuditLog: CLAIM_CLOSED
  Trigger: Vehicle P&L report updated with repair cost
```

### State After Workflow 7
```
Claim.status       = SETTLED or CLOSED
Vehicle.status     = AVAILABLE (post-repair) or RETIRED (total loss)
VehicleCost        = repair cost logged against vehicle P&L
DamageItem.claimId = linked to resolved claim
```

---

## SYSTEM TRIGGERS SUMMARY

| Event | Trigger | Who Notified |
|---|---|---|
| Booking created | AuditLog + optional customer SMS/email | Staff, Customer |
| Booking confirmed (paid) | AuditLog + confirmation notification | Customer |
| Vehicle reserved | AuditLog | Internal |
| Vehicle checked out | AuditLog + rental start notification | Customer |
| Booking end date approaching (T-1 day) | Automation alert | Staff |
| Vehicle checked in | AuditLog | Internal |
| Deposit refunded | AuditLog + refund notification | Customer |
| Deposit forfeited | AuditLog + damage notification | Customer |
| Claim opened | AuditLog | Manager, Finance |
| Compliance item expiring (30 days) | Automation alert | Manager, Owner |
| Licence expiring (customer) | Automation alert | Staff, Customer |

---

## DATA MUTATION SUMMARY PER WORKFLOW

| Workflow | Models Written/Updated |
|---|---|
| 1 — Booking | `Customer`, `Booking` |
| 2 — Payment + Deposit | `Payment` (×2), `Deposit`, `Booking`, `Contract` |
| 3 — Vehicle Allocation | `Vehicle`, `Booking` |
| 4 — Check-out | `Inspection`, `DamageItem`(×n), `Vehicle`, `Booking` |
| 5 — Check-in | `Inspection`, `DamageItem`(×n), `Vehicle`, `Booking` |
| 6 — Refund | `Refund`, `Deposit`, `Payment` (damage charge) |
| 7 — Damage/Claim | `Claim`, `DamageItem`, `Document`, `VehicleCost`, `InsurancePolicy` |
| All | `AuditLog` (every step) |
