// ============================================================
// DATABASE SEED
// Creates the initial OWNER user and a default Location.
// Run once after first migration: npm run db:seed
//
// WARNING: Re-running this script is idempotent — it uses
// upsert so it will not create duplicates, but it WILL
// update the owner password to the SEED_OWNER_PASSWORD value.
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // ── Config (override via environment) ─────────────────────
  const ownerEmail    = process.env.SEED_OWNER_EMAIL    ?? 'owner@rentalos.app'
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? 'Change_me_immediately_123!'
  const ownerName     = process.env.SEED_OWNER_NAME     ?? 'System Owner'
  const locationName  = process.env.SEED_LOCATION_NAME  ?? 'Head Office'

  // ── Default Location ──────────────────────────────────────
  let location = await prisma.location.findFirst({
    where: { name: locationName },
  })

  if (!location) {
    location = await prisma.location.create({
      data: {
        name:    locationName,
        address: '1 Main Street, Johannesburg',
        city:    'Johannesburg',
        country: 'ZA',
        phone:   '+27 11 000 0000',
        email:   'info@rentalos.app',
      },
    })
  }

  console.log(`✅ Location: ${location.name} (${location.id})`)

  // ── Owner User ────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(ownerPassword, 12)

  const [firstName, ...lastParts] = ownerName.split(' ')
  const lastName = lastParts.join(' ') || 'User'

  const owner = await prisma.user.upsert({
    where:  { email: ownerEmail },
    update: { passwordHash: hashedPassword },
    create: {
      email:        ownerEmail,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      role:         'OWNER',
      status:       'ACTIVE',
      locationId:   location.id,
    },
  })

  console.log(`✅ Owner user: ${owner.email} (${owner.id})`)
  console.log()
  console.log('─────────────────────────────────────────────────')
  console.log('  SEED COMPLETE — Initial credentials:')
  console.log(`  Email:    ${ownerEmail}`)
  console.log(`  Password: ${ownerPassword}`)
  console.log('  ⚠️  Change this password immediately after first login!')
  console.log('─────────────────────────────────────────────────')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Seed failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
