// Add missing password_changed_at column to staff_users table
require('dotenv/config')
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL || 'postgresql://nofol_users:Anoopnefoldb@localhost:5432/nefol'
const pool = new Pool({ connectionString })

async function addColumn() {
  try {
    console.log('🔄 Adding password_changed_at column to staff_users table...')
    
    // Check if column exists
    const { rows: columnCheck } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'staff_users' 
      AND column_name = 'password_changed_at'
    `)
    
    if (columnCheck.length > 0) {
      console.log('✅ Column password_changed_at already exists')
      await pool.end()
      process.exit(0)
    }
    
    // Add the column
    await pool.query(`
      ALTER TABLE staff_users 
      ADD COLUMN password_changed_at timestamptz
    `)
    
    console.log('✅ Successfully added password_changed_at column to staff_users table')
    
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error adding column:', error.message)
    await pool.end()
    process.exit(1)
  }
}

addColumn()

