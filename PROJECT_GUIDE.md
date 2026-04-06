# Bike Training Booking — Project guide

## 1. Overview

**Kolkata Scotty Training** is a full-stack app for booking two-wheeler training slots. Customers pick a date and time, choose an **active trainer (driver)**, and the system assigns a **training vehicle** with spare capacity. Admins manage trainers, vehicles, customers, and operational settings.

| Area | Stack |
|------|--------|
| Frontend | Angular (standalone components), deployed static (e.g. Vercel) |
| Backend | Node.js, Express, `pg`, JWT + Google OAuth |
| Database | PostgreSQL (Supabase migrations under `supabase/migrations/`) |

---

## 2. How the system works

### User (customer) flow

1. Sign in with Google (JWT in localStorage + cookies where configured).
2. Open **Book** → choose a **date** (today or future) → see **bookable** slots for that day.
3. Open the booking modal → select an **active trainer** → enter **10-digit mobile** (must match profile when profile already has a real number) → complete captcha → confirm.
4. **One active booking at a time**: if the user already has a non-terminal booking for a slot that has not ended, the API returns `ACTIVE_BOOKING_EXISTS` and the UI shows a clear message; after **cancel** (within rules), they can book again.
5. **My bookings** lists only rows for `user_id` from the authenticated session.

### Admin flow

1. Admin signs in → dashboard, users, trainers, vehicles, bookings as exposed by `/api/admin/*`.
2. **Slots** for the next windows are maintained by **automatic nightly generation** (see below); manual generation remains available for specific dates via admin slot tools where implemented.
3. **Reactivate** customers flagged `inactive_blocked` (see inactivity job) when appropriate.

---

## 3. Slot generation logic

- **Cron**: `AUTO_SLOT_CRON` (default `0 0 * * *` — midnight) with timezone `AUTO_SLOT_CRON_TZ` (default `Asia/Kolkata`). Disable with `DISABLE_AUTO_SLOT_CRON=1`.
- **Scope**: For each run, the job ensures the **slot grid exists for 7 calendar days starting from “today”** (server `getToday()` in UTC calendar terms, consistent with existing date helpers).
- **Past dates**: Generation rejects **only** dates **before** today.
- **Per day**: Weekday/Sunday templates, capacity from `SLOT_CAPACITY` in `backend/config/app.config.js`, `booked_count` starts at 0; round-robin `trainer_id` on the slot row is a **default** hint; bookings may use **any** active trainer subject to uniqueness rules.
- **First deploy / empty DB**: Set `AUTO_SLOT_RUN_ON_START=1` once so the grid is created without waiting for midnight.

Code: `backend/services/slotGeneration.service.js` (`runNightlyAutoGeneration`, `generateSlotsForDate`).

---

## 4. Booking logic

- **Bookable slots** (customer list): `start_time` in the future, within `SLOT_VISIBILITY_HOURS` (24h by default), `booked_count < capacity`, slot/trainer not disabled, slot row has a trainer reference and linked trainer is active — see `backend/utils/slotBookableSql.js` and `bookingValidation.service.js`.
- **Capacity**: Slot-level `capacity` / `booked_count` plus per-vehicle caps via `slot_vehicle_capacity` when present.
- **Single active booking**: Enforced in `backend/routes/bookings.js` and `bookingValidation.service.js` (`ACTIVE_BOOKING_EXISTS`).
- **Phone**: Normalized 10-digit Indian mobile; must match registered profile when not using placeholder phone.

---

## 5. Driver / trainer assignment logic

- **Dropdown**: `GET /api/trainers/available-for-slot/:slotId` returns **all trainers with `is_active = true`** (slot id only validates that the slot exists).
- **Per booking**: The customer sends **`trainer_id`**. The server checks the trainer is active and **not already used** for that `slot_id` on a non-cancelled booking.
- **Uniqueness**: Partial unique index `idx_bookings_slot_trainer_active` on `(slot_id, trainer_id)` for non-cancelled rows — same trainer cannot serve two parallel bookings on the same slot.
- **Vehicle**: Still **server-assigned** via `assignVehicleForSlot` (first vehicle type with spare capacity). If no `trainer_id` is sent, legacy path `assignTrainerAndVehicleForSlot` auto-picks trainer + vehicle (e.g. API clients).

---

## 6. Inactive user blocking (45 days)

- Cron: `INACTIVITY_CRON` (default `0 2 * * *`), `INACTIVITY_BLOCK_DAYS` (default `45`). Disable with `DISABLE_INACTIVITY_CRON=1`.
- Customers with no qualifying activity for 45 days get `profiles.inactive_blocked = true`. Email alert to admin when `ADMIN_ALERT_EMAIL` / SMTP is configured.
- **Schema**: Use `inactive_blocked` (boolean) and `last_booking_date` (date) — not camelCase in the database.
- Admin can clear `inactive_blocked` to reactivate.

Code: `backend/services/inactivity.service.js`.

---

## 7. Setup (local)

### Install

```bash
# Backend
cd backend && npm install

# Frontend
cd ../ && npm install
```

### Environment

Copy `backend/.env.example` → `backend/.env` and set `DATABASE_URL`, `JWT_SECRET`, OAuth URLs, `FRONTEND_URL`, and optional email/cron vars.

Frontend: set `src/environments/environment.ts` `apiUrl` to `http://localhost:3000/api` (or your deployed API).

### Run database migrations

Apply SQL under `supabase/migrations/` in order on your PostgreSQL instance (or use Supabase CLI if that is your workflow).

### Run backend

```bash
cd backend && npm start
# or node server.js / npm run dev per package.json
```

### Run frontend

```bash
npm start
# default http://localhost:4200
```

---

## 8. Deployment (checklist)

1. PostgreSQL with all migrations applied.
2. Backend host: set `NODE_ENV=production`, secrets, `FRONTEND_URL`, CORS-compatible origins.
3. Enable crons or equivalent schedulers for **slot generation** and **inactivity** (or run `runNightlyAutoGeneration` / `runInactivityBlockCheck` via external cron hitting internal endpoints if you add them).
4. Frontend: build `ng build --configuration production` and deploy `dist/`; ensure API URL points to production.
5. Optional: `AUTO_SLOT_RUN_ON_START=1` only for first boot after empty slots — then disable to avoid extra work on every restart.

---

## 9. Database maintenance scripts

- **Transactional reset** (bookings, slots, related): `scripts/database/clear_transactional_data.sql`
- **Optional**: After clearing slots/bookings, run nightly generation or admin generate to refill.

To **optional reset customer profiles** while keeping admins/trainers, add tailored SQL in your environment (backup first); there is no one-size-fits-all delete without knowing how `trainers.user_id` links to `profiles`.

---

## 10. API quick reference

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/slots/...` | Public list / by date / available |
| GET | `/api/trainers/available-for-slot/:id` | Active trainers for booking UI |
| POST | `/api/bookings` | Auth; body: `slot_id`, `trainer_id`, `phone`, `notes` |
| GET | `/api/bookings/my-bookings` | Auth; current user only |
| PUT | `/api/bookings/:id/cancel` | Auth; cancellation rules apply |

---

## 11. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| No slots “today” | Cron not run yet; DB empty; or `AUTO_SLOT_RUN_ON_START` not set on first deploy |
| Trainers not in dropdown | No rows in `trainers` with `is_active = true` |
| `TRAINER_SLOT_TAKEN` | Another user booked that trainer for the same slot |
| `ACTIVE_BOOKING_EXISTS` | User must cancel existing future booking first |
| `INACTIVE_BLOCKED` | 45-day rule or manual block; admin reactivates |

For the canonical short README entry point, see **`README.md`** at the repository root.
