# System Analysis Report — Bike / Scooty Training Slot Booking

**Generated:** 2026-03-21  
**Scope:** Backend (Node/Express + PostgreSQL), Frontend (Angular), Supabase migrations.

---

## 1. Executive summary

The system is a **vehicle-aware slot booking platform** with admin slot generation, trainer assignment, phone-based identity, optional student recognition/entitlements, and **admin audit logging** (`admin_audit_log`). Core business rules are enforced in `backend/config/app.config.js`, `backend/services/bookingValidation.service.js`, `backend/routes/bookings.js`, and `backend/routes/slots.js`.

This report reflects the **post-remediation** codebase state (see `QA_REPORT.md` for verification notes).

---

## 2. API surface (summary)

Base path: `/api` (see also `API_ENDPOINT_INVENTORY.md` for the full table).

| Area | Prefix | Purpose |
|------|--------|---------|
| Auth | `/api/auth` | Login, Google OAuth, logout, `me` |
| Profiles | `/api/profiles` | User profile CRUD (self) |
| Trainers | `/api/trainers` | Public trainer listing |
| Slots | `/api/slots` | Public slot queries; admin create/update/delete/generate |
| Bookings | `/api/bookings` | Create booking, my bookings, cancel |
| Admin | `/api/admin` | Dashboard, bookings, users, slots, settings, audit logs |
| Admin management | `/api/admin-management` | Separate `admins` table operations |
| Vehicles | `/api/vehicles` | Vehicle catalog (`max_per_slot`) |
| Settings | `/api/settings` | Key/value settings |
| Ratings | `/api/ratings` | Post/list ratings |
| Recognition | `/api/recognition` | Student invoice verification (optional tables) |
| Health | `/health` | Liveness |
| SSE | `/api/events` | Slot change broadcasts |

---

## 3. Database schema (conceptual)

| Table | Role |
|-------|------|
| `profiles` | Users; **phone** is unique identity for booking rules; roles |
| `trainers` | Trainer records linked to `profiles` |
| `slots` | `start_time`, `end_time`, `slot_date`, aggregate `capacity`, `booked_count`, `status`, `is_visible`, trainer |
| `vehicles` | Dynamic vehicles: `name`, `max_per_slot`, `is_active` |
| `slot_vehicle_capacity` | **Per-slot, per-vehicle** capacity (canonical for limits) |
| `bookings` | `user_id`, `slot_id`, `trainer_id`, `vehicle_id`, `phone`, `status`, … |
| `admin_audit_log` | `admin_id`, `action_type`, `entity_type`, `entity_id`, `before_value`, `after_value`, `details` |
| `settings` | App configuration rows |
| `ratings` | Trainer ratings |
| `student_recognition`, `student_entitlements` | Optional gating (if tables exist) |
| `admins` | Admin accounts (management API) |

**Legacy columns** on `slots` (e.g. `electric_capacity`, …) may still exist on older DBs from migration `20260116000100_enforce_slot_schema.sql`; runtime logic prefers **`slot_vehicle_capacity`**.

**Migration added in this pass:** `supabase/migrations/20260321000000_drop_slots_capacity_eq5_constraint.sql` — drops `slots_capacity_check` (`capacity = 5`) so totals can follow the sum of per-vehicle capacities without forcing exactly 5 at the row level (aggregate `booked_count` is still guarded by `slots_booked_count_check`).

---

## 4. Data flow: booking → slot → admin

1. **Admin** generates slots (`POST /api/slots/generate`) for a **future** calendar date (`slot_date` > server “today” UTC per `getToday()`). Rows are inserted into `slots` and `slot_vehicle_capacity` (via `ensure_slot_vehicle_capacities` where available).
2. **Admin** assigns trainers (`PUT /api/slots/:id/trainer`). Slot updates are audited (`CREATE_SLOT`, `UPDATE_SLOT`, `DELETE_SLOT`).
3. **Customer** sees slots for a date (`GET /api/slots/date/:date`) with **`vehicle_capacities`** (booked counts from `bookings`).
4. **Customer** books (`POST /api/bookings`): validation uses **phone**, **weekly limit**, **booking window** (24h before start — see below), vehicle capacity from **`slot_vehicle_capacity`** (fallback `vehicles.max_per_slot`), row lock on slot.
5. **Customer** cancels (`PUT /api/bookings/:id/cancel`): **5h** rule via `validateCancellationEligibility`; slot `booked_count` decremented; audit **`USER_CANCEL_BOOKING`** (customer) or **`CANCEL_BOOKING`** (admin).

---

## 5. Business rules (implemented)

| Rule | Implementation |
|------|----------------|
| 30 min slots; Mon–Sat 07:00–21:00; Sun windows | `backend/app.config.js` + `routes/slots.js` generation |
| Max 5 total / 3+1+1 by vehicle | `vehicles.max_per_slot` + `slot_vehicle_capacity` |
| Max 2 bookings / user / week | `bookingValidation.service.js` (by `profiles.phone`, `slots.slot_date`, ISO week) |
| Booking opens 24h before slot | **Window:** book only if `0 < hoursUntilSlot ≤ 24` (aligned across validation, booking SQL CTE, `/available`, `is_visible` updates) |
| Cancel up to 5h before | `CANCELLATION_WINDOW_HOURS = 5` |
| Phone = unique user for limits | Normalized phone in validation + booking route |
| Audit | `audit.service.js` + `admin_audit_log`; customer cancel logged as `USER_CANCEL_BOOKING` |

---

## 6. Prior gaps / remediated areas

| Issue | Remediation |
|-------|-------------|
| Cancel route selected non-existent `electric_booked` / `bike_booked` on `slots` | Query reduced to `booked_count` / `capacity` only |
| `bookingValidation` selected removed slot vehicle columns | SELECT trimmed; capacity via `getEffectiveCapacityForSlot` |
| Booking window contradicted “opens 24h before” | Unified to **inside** 24h pre-start window |
| `/available` used inverted time filter | Fixed to `start_time > now AND start_time ≤ now + 24h` |
| `update-visibility` fallback inverted | Same predicate as booking window |
| Sunday morning times not IST-offset like weekdays | Morning block uses `convertISTToUTC` |
| `checkVehicleAvailability` ignored `slot_vehicle_capacity` | `getEffectiveCapacityForSlot` added |
| Booking INSERT CTE used only `vehicles.max_per_slot` | Subquery on `slot_vehicle_capacity` with COALESCE |
| Admin UI showed legacy electric/petrol/bike columns | Renders `vehicle_capacities` from API; legacy fallback if empty |
| `PUT /vehicle-capacity` body mismatch | Frontend sends `{ vehicle_capacities: { [uuid]: n } }` |
| Strict `slots_capacity_check` | Optional migration to drop |

---

## 7. UI pages (Angular)

| Path | Component |
|------|-----------|
| `/` | Home |
| `/about`, `/courses`, `/contact`, `/trainers` | Marketing / info |
| `/booking` | Customer booking |
| `/profile` | Profile (auth) |
| `/admin/login` | Admin login |
| `/admin` | Dashboard |
| `/admin/bookings`, `/admin/slots`, `/admin/trainers`, `/admin/users`, `/admin/vehicles`, `/admin/settings`, `/admin/audit-logs` | Admin console |

---

## 8. Files touched in this alignment (reference)

- `backend/routes/bookings.js` — CTE window + capacity; cancel SQL + user audit; logging noise reduced  
- `backend/routes/slots.js` — `/available`, visibility SQL, Sunday IST, generation `slot_date > today`, vehicle UUID compare  
- `backend/services/bookingValidation.service.js` — window + capacity + SELECT cleanup  
- `backend/services/vehicle.service.js` — `getEffectiveCapacityForSlot`  
- `backend/services/audit.service.js` — `logUserBookingCancellation`  
- `backend/middleware/errorHandler.js` — `data` payload for hints (`suggestedDate`, `nextAvailableDate`, …)  
- `backend/config/app.config.js` — `BOOKING_WINDOW_HOURS`  
- `backend/app.config.js` — messaging  
- `src/app/services/slot.service.ts` — `vehicle_capacities`, generate URL, `vehicle_capacities` PUT body  
- `src/app/admin/pages/slots/slots.component.ts` — dynamic vehicle rows, search/select width, future-only generation UX  
- `supabase/migrations/20260321000000_drop_slots_capacity_eq5_constraint.sql`  

---

## 9. Operational notes

- Apply new SQL migration in non-destructive order after backups:  
  `node backend/apply_migration.js supabase/migrations/20260321000000_drop_slots_capacity_eq5_constraint.sql`
- If `slot_vehicle_capacity` is missing, several routes already document required migrations; booking INSERT assumes the table exists for the capacity subquery — **apply** `20260124000000` / `20260125000004` migrations on the database.

---

*End of report.*
