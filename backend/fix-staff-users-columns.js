// Add missing columns to staff_users table to match the schema
require('dotenv/config')
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL || 'postgresql://nofol_users:Anoopnefoldb@localhost:5432/nefol'
const pool = new Pool({ connectionString })

async function addMissingColumns() {
  try {
    console.log('🔄 Checking and adding missing columns to staff_users table...')
    
    const columnsToAdd = [
      { name: 'last_login_at', type: 'timestamptz' },
      { name: 'last_logout_at', type: 'timestamptz' },
      { name: 'failed_login_attempts', type: 'integer', defaultValue: 'DEFAULT 0' },
      { name: 'last_failed_login_at', type: 'timestamptz' }
    ]
    
    for (const column of columnsToAdd) {
      // Check if column exists
      const { rows: columnCheck } = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'staff_users' 
        AND column_name = $1
      `, [column.name])
      
      if (columnCheck.length > 0) {
        console.log(`✅ Column ${column.name} already exists`)
      } else {
        // Add the column
        const defaultValue = column.defaultValue ? ` ${column.defaultValue}` : ''
        await pool.query(`
          ALTER TABLE staff_users 
          ADD COLUMN ${column.name} ${column.type}${defaultValue}
        `)
        console.log(`✅ Successfully added column ${column.name}`)
      }
    }
    
    console.log('\n✅ All required columns are now present in staff_users table')
    
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error adding columns:', error.message)
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    await pool.end()
    process.exit(1)
  }
}

addMissingColumns()

