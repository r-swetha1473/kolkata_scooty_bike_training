// Quick fix script to add missing vehicle capacity columns to slots table
// Usage: cd backend && node fix_vehicle_capacity_columns.js

const db = require('./db');

async function fixColumns() {
  try {
    console.log('Adding vehicle capacity columns to slots table...');
    console.log('');

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Add electric_capacity column if not exists
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'slots' 
              AND column_name = 'electric_capacity'
          ) THEN
            ALTER TABLE slots ADD COLUMN electric_capacity INTEGER NOT NULL DEFAULT 3;
          END IF;
        END $$;
      `);
      console.log('✓ Checked electric_capacity column');

      // Add petrol_capacity column if not exists
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'slots' 
              AND column_name = 'petrol_capacity'
          ) THEN
            ALTER TABLE slots ADD COLUMN petrol_capacity INTEGER NOT NULL DEFAULT 1;
          END IF;
        END $$;
      `);
      console.log('✓ Checked petrol_capacity column');

      // Add bike_capacity column if not exists
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'slots' 
              AND column_name = 'bike_capacity'
          ) THEN
            ALTER TABLE slots ADD COLUMN bike_capacity INTEGER NOT NULL DEFAULT 1;
          END IF;
        END $$;
      `);
      console.log('✓ Checked bike_capacity column');

      // Update existing slots with default values if NULL
      const updateResult = await client.query(`
        UPDATE slots 
        SET electric_capacity = 3, 
            petrol_capacity = 1, 
            bike_capacity = 1
        WHERE electric_capacity IS NULL 
           OR petrol_capacity IS NULL 
           OR bike_capacity IS NULL
      `);
      console.log(`✓ Updated ${updateResult.rowCount} existing slots with default values`);

      // Add constraint if not exists
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'slots_vehicle_capacity_check'
          ) THEN
            ALTER TABLE slots ADD CONSTRAINT slots_vehicle_capacity_check 
              CHECK (electric_capacity + petrol_capacity + bike_capacity = 5);
          END IF;
        END $$;
      `);
      console.log('✓ Checked vehicle capacity constraint');

      await client.query('COMMIT');
      console.log('');
      console.log('✅ Successfully added vehicle capacity columns!');
      console.log('');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fixing columns:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixColumns();
