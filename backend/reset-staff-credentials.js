// Reset Staff/Admin Credentials Script
// This script creates/updates admin users in the staff_users table

require('dotenv/config')
const { Pool } = require('pg')
const crypto = require('crypto')

const connectionString = process.env.DATABASE_URL || 'postgresql://nofol_users:Anoopnefoldb@localhost:5432/nefol'
const pool = new Pool({ connectionString })

const parseArgs = () => {
  const args = process.argv.slice(2)
  const result = {}
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i]
    if (!current.startsWith('--')) continue
    const key = current.replace(/^--/, '').toLowerCase()
    const next = args[i + 1]
    if (!next || next.startsWith('--')) {
      result[key] = 'true'
    } else {
      result[key] = next
      i += 1
    }
  }
  return result
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const argMap = parseArgs()

const ADMIN_EMAIL = argMap.email || process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = argMap.password || process.env.ADMIN_PASSWORD
const ADMIN_NAME = argMap.name || process.env.ADMIN_NAME || 'Admin User'

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌ Missing required credentials.')
  console.error('   Provide values via environment variables or CLI flags:')
  console.error('   ADMIN_EMAIL / --email <value>')
  console.error('   ADMIN_PASSWORD / --password <value>')
  process.exit(1)
}

async function resetStaffCredentials() {
  console.log('🔄 Resetting staff/admin credentials...')
  console.log(`📧 Email: ${ADMIN_EMAIL}`)
  console.log(`🔑 Password: ${ADMIN_PASSWORD}`)
  console.log(`👤 Name: ${ADMIN_NAME}`)
  
  try {
    // Hash the password properly
    const hashedPassword = hashPassword(ADMIN_PASSWORD)
    
    // Check if staff user exists
    const { rows: existingStaff } = await pool.query(
      'SELECT id, email, name, is_active FROM staff_users WHERE email = $1',
      [ADMIN_EMAIL]
    )

    if (existingStaff.length > 0) {
      // Update existing staff user
      console.log('✅ Staff user found, updating password...')
      console.log(`   Existing Staff ID: ${existingStaff[0].id}`)
      const result = await pool.query(
        `UPDATE staff_users 
         SET password = $1, name = $2, is_active = true, updated_at = NOW(),
             failed_login_attempts = 0
         WHERE email = $3 
         RETURNING id, email, name, is_active`,
        [hashedPassword, ADMIN_NAME, ADMIN_EMAIL]
      )
      console.log(`✅ Staff credentials updated successfully!`)
      console.log(`   Staff ID: ${result.rows[0].id}`)
    } else {
      // Create new staff user
      console.log('✅ Creating new staff user...')
      const { rows: newStaff } = await pool.query(
        `INSERT INTO staff_users (name, email, password, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         RETURNING id, email, name, is_active`,
        [ADMIN_NAME, ADMIN_EMAIL, hashedPassword]
      )
      console.log(`✅ Staff user created successfully!`)
      console.log(`   Staff ID: ${newStaff[0].id}`)
    }

    // Verify the staff user was created/updated correctly
    const { rows: verifyStaff } = await pool.query(
      'SELECT id, email, name, is_active, created_at FROM staff_users WHERE email = $1',
      [ADMIN_EMAIL]
    )

    if (verifyStaff.length === 0) {
      throw new Error('Staff user was not created/updated successfully!')
    }

    const staff = verifyStaff[0]
    console.log('\n✅ Verification:')
    console.log(`   Staff ID: ${staff.id}`)
    console.log(`   Email: ${staff.email}`)
    console.log(`   Name: ${staff.name}`)
    console.log(`   Is Active: ${staff.is_active}`)
    console.log(`   Created At: ${staff.created_at}`)

    // Display final credentials
    console.log('\n📋 Staff/Admin Login Credentials:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`   Email:    ${ADMIN_EMAIL}`)
    console.log(`   Password: ${ADMIN_PASSWORD}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error resetting staff credentials:', error)
    console.error('   Error details:', error.message)
    if (error.stack) {
      console.error('   Stack:', error.stack)
    }
    await pool.end()
    process.exit(1)
  }
}

resetStaffCredentials()

