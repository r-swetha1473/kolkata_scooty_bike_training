# Complete PostgreSQL Implementation Plan

## Summary of Changes Required

You have a working backend already, but it needs updates to match your requirements. Here's the complete plan:

## 1. Database Schema (✓ Created)

File: `backend/schema_new.sql`

**Tables:**
- `tbl_users` - All users (customers, trainers, admins)
- `tbl_trainers` - Trainer profiles (extends tbl_users)
- `tbl_slots` - 30-minute slots (9 AM - 9 PM)
- `tbl_bookings` - Booking records
- `tbl_audit_logs` - Activity tracking
- `tbl_settings` - System configuration

**Key Features:**
- Proper foreign keys
- Indexes for performance
- Auto-update timestamps
- SERIAL IDs (auto-increment)

## 2. Backend Updates Needed

### Update db.js
```javascript
// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = pool;
```

### Create Trainer Routes
```javascript
// backend/routes/trainers.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { isAdmin } = require('../middleware/auth');

// Get all trainers (with user info)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.full_name, u.email, u.phone, u.profile_image
      FROM tbl_trainers t
      JOIN tbl_users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active trainers only
router.get('/active', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.full_name, u.email, u.profile_image
      FROM tbl_trainers t
      JOIN tbl_users u ON t.user_id = u.id
      WHERE t.is_active = true
      ORDER BY t.rating DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create trainer (Admin only)
router.post('/', isAdmin, async (req, res) => {
  const { email, full_name, phone, bio, experience_years, specialization } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create user with trainer role
    const defaultPassword = 'trainer123'; // Change on first login
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const userResult = await client.query(`
      INSERT INTO tbl_users (email, password_hash, full_name, phone, role)
      VALUES ($1, $2, $3, $4, 'trainer')
      RETURNING id
    `, [email, passwordHash, full_name, phone]);

    const userId = userResult.rows[0].id;

    // Create trainer profile
    const trainerResult = await client.query(`
      INSERT INTO tbl_trainers (user_id, bio, experience_years, specialization)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [userId, bio, experience_years || 0, specialization || []]);

    await client.query('COMMIT');

    res.json({
      trainer: trainerResult.rows[0],
      message: 'Trainer created successfully. Default password: trainer123'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Update trainer
router.put('/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { bio, experience_years, specialization, is_active, full_name, phone } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update trainer
    await client.query(`
      UPDATE tbl_trainers
      SET bio = COALESCE($1, bio),
          experience_years = COALESCE($2, experience_years),
          specialization = COALESCE($3, specialization),
          is_active = COALESCE($4, is_active)
      WHERE id = $5
    `, [bio, experience_years, specialization, is_active, id]);

    // Update user info if provided
    if (full_name || phone) {
      await client.query(`
        UPDATE tbl_users u
        SET full_name = COALESCE($1, u.full_name),
            phone = COALESCE($2, u.phone)
        FROM tbl_trainers t
        WHERE t.user_id = u.id AND t.id = $3
      `, [full_name, phone, id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Trainer updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Toggle trainer status
router.patch('/:id/toggle-status', isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      UPDATE tbl_trainers
      SET is_active = NOT is_active
      WHERE id = $1
      RETURNING is_active
    `, [id]);

    // If trainer becomes inactive, cancel their future slots
    if (!result.rows[0].is_active) {
      await pool.query(`
        UPDATE tbl_slots
        SET status = 'cancelled'
        WHERE trainer_id = $1
        AND slot_date >= CURRENT_DATE
        AND status = 'available'
      `, [id]);
    }

    res.json({ is_active: result.rows[0].is_active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete trainer
router.delete('/:id', isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM tbl_trainers WHERE id = $1', [id]);
    res.json({ message: 'Trainer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Create Slot Management Routes
```javascript
// backend/routes/slots.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAdmin } = require('../middleware/auth');

// Generate 30-minute slots from 9 AM to 9 PM
function generateSlots() {
  const slots = [];
  for (let hour = 9; hour < 21; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const endMinute = minute + 30;
      const endHour = endMinute >= 60 ? hour + 1 : hour;
      const end = `${endHour.toString().padStart(2, '0')}:${(endMinute % 60).toString().padStart(2, '0')}`;
      slots.push({ start, end });
    }
  }
  return slots;
}

// Create slots for a trainer and date range
router.post('/generate', isAdmin, async (req, res) => {
  const { trainer_id, start_date, end_date } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const timeSlots = generateSlots();
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    let created = 0;

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];

      for (const slot of timeSlots) {
        try {
          await client.query(`
            INSERT INTO tbl_slots (trainer_id, slot_date, start_time, end_time)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (trainer_id, slot_date, start_time) DO NOTHING
          `, [trainer_id, dateStr, slot.start, slot.end]);
          created++;
        } catch (err) {
          // Skip duplicates
        }
      }
    }

    await client.query('COMMIT');
    res.json({ message: `Created ${created} slots successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get available slots
router.get('/', async (req, res) => {
  const { date, trainer_id } = req.query;

  try {
    let query = `
      SELECT s.*, t.*, u.full_name as trainer_name
      FROM tbl_slots s
      JOIN tbl_trainers t ON s.trainer_id = t.id
      JOIN tbl_users u ON t.user_id = u.id
      WHERE t.is_active = true
    `;
    const params = [];

    if (date) {
      params.push(date);
      query += ` AND s.slot_date = $${params.length}`;
    }

    if (trainer_id) {
      params.push(trainer_id);
      query += ` AND s.trainer_id = $${params.length}`;
    }

    query += ' ORDER BY s.slot_date, s.start_time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update slot
router.put('/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { trainer_id, status } = req.body;

  try {
    await pool.query(`
      UPDATE tbl_slots
      SET trainer_id = COALESCE($1, trainer_id),
          status = COALESCE($2, status)
      WHERE id = $3
    `, [trainer_id, status, id]);

    res.json({ message: 'Slot updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete slot
router.delete('/:id', isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM tbl_slots WHERE id = $1', [id]);
    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Update Google OAuth (config/passport.js)
```javascript
// backend/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      let result = await pool.query(
        'SELECT * FROM tbl_users WHERE google_id = $1',
        [profile.id]
      );

      if (result.rows.length > 0) {
        // User exists, return user
        return done(null, result.rows[0]);
      }

      // Create new user
      result = await pool.query(`
        INSERT INTO tbl_users (
          email, full_name, profile_image, google_id, role
        ) VALUES ($1, $2, $3, $4, 'customer')
        RETURNING *
      `, [
        profile.emails[0].value,
        profile.displayName,
        profile.photos[0]?.value,
        profile.id
      ]);

      done(null, result.rows[0]);
    } catch (error) {
      done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM tbl_users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
```

### Create Booking Routes
```javascript
// backend/routes/bookings.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated } = require('../middleware/auth');

// Create booking
router.post('/', isAuthenticated, async (req, res) => {
  const { slot_id, notes } = req.body;
  const user_id = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if slot is available
    const slotResult = await client.query(`
      SELECT * FROM tbl_slots WHERE id = $1 FOR UPDATE
    `, [slot_id]);

    if (slotResult.rows.length === 0) {
      throw new Error('Slot not found');
    }

    const slot = slotResult.rows[0];

    if (slot.status !== 'available' || slot.booked_count >= slot.capacity) {
      throw new Error('Slot already booked');
    }

    // Create booking
    const bookingResult = await client.query(`
      INSERT INTO tbl_bookings (user_id, trainer_id, slot_id, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [user_id, slot.trainer_id, slot_id, notes]);

    // Update slot
    await client.query(`
      UPDATE tbl_slots
      SET booked_count = booked_count + 1,
          status = CASE WHEN booked_count + 1 >= capacity THEN 'booked' ELSE 'available' END
      WHERE id = $1
    `, [slot_id]);

    await client.query('COMMIT');
    res.json(bookingResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get user bookings
router.get('/my', isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*,
             s.slot_date, s.start_time, s.end_time,
             u.full_name as trainer_name, u.profile_image as trainer_image,
             t.rating as trainer_rating
      FROM tbl_bookings b
      JOIN tbl_slots s ON b.slot_id = s.id
      JOIN tbl_trainers t ON b.trainer_id = t.id
      JOIN tbl_users u ON t.user_id = u.id
      WHERE b.user_id = $1
      ORDER BY s.slot_date DESC, s.start_time DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel booking
router.post('/:id/cancel', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { cancellation_reason } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const booking = await client.query(`
      SELECT * FROM tbl_bookings WHERE id = $1 AND user_id = $2
    `, [id, req.user.id]);

    if (booking.rows.length === 0) {
      throw new Error('Booking not found');
    }

    // Update booking
    await client.query(`
      UPDATE tbl_bookings
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = $1
      WHERE id = $2
    `, [cancellation_reason, id]);

    // Update slot
    await client.query(`
      UPDATE tbl_slots
      SET booked_count = booked_count - 1,
          status = 'available'
      WHERE id = $1
    `, [booking.rows[0].slot_id]);

    await client.query('COMMIT');
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
```

## 3. Frontend Updates

Due to length limitations, the key changes needed:

1. **Remove all Supabase references** (already done)
2. **Update HttpService** to handle proper error responses
3. **Create TrainerService** for trainer management
4. **Create SlotService** for slot operations
5. **Create ProfileComponent** for user profile page
6. **Update Admin Trainer Page** with CRUD operations
7. **Update Admin Slot Page** with 30-min slot generation

## 4. Setup Instructions

```bash
# 1. Create database
createdb kolkata_scotty

# 2. Run schema
psql -d kolkata_scotty -f backend/schema_new.sql

# 3. Create admin user
psql -d kolkata_scotty
INSERT INTO tbl_users (email, password_hash, full_name, role)
VALUES ('admin@kolkatascotty.com', '$2b$10$hash', 'Admin', 'admin');

# 4. Configure backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/kolkata_scotty
JWT_SECRET=your-secret
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret

# 5. Start backend
cd backend && npm install && npm run dev

# 6. Start frontend
npm start
```

## Files Created/Updated

- ✅ `backend/schema_new.sql` - New PostgreSQL schema
- ⏳ `backend/routes/trainers.js` - Trainer CRUD
- ⏳ `backend/routes/slots.js` - Slot management with 30-min intervals
- ⏳ `backend/routes/bookings.js` - Booking with validation
- ⏳ `backend/config/passport.js` - Google OAuth with auto user creation
- ⏳ `src/app/pages/profile` - User profile component
- ⏳ Frontend service updates

This is a comprehensive plan. Would you like me to continue implementing the remaining pieces?
