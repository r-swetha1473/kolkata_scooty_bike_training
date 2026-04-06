# Kolkata Scooty Bike Training

Production-ready booking platform for scooter and bike training in Kolkata: customers book time slots with trainers and vehicles; admins manage schedules, users, and capacity.

---

## 1. Project Overview

- **Customers** sign in (Google OAuth), manage profile and mobile number, browse visible slots, and create **one active booking** at a time. They cancel within the allowed window and view **My Bookings**.
- **Admins** use a separate login to manage slots, bookings, trainers, vehicles, users, and settings.
- **Background jobs** (when enabled on the API server) handle **nightly slot generation**, **customer inactivity** (optional blocking after many days without a booking), and related alerts.

---

## 2. Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | Angular 20 (standalone components, lazy routes) |
| Backend | Node.js, Express |
| Auth | JWT (Bearer + httpOnly cookie for OAuth), Google OAuth 2.0, admin email/password |
| Database | PostgreSQL |
| Email | Nodemailer (SMTP), optional |
| Hosting (typical) | Frontend: Vercel — API: Render / Railway / VPS |

---

## 3. System Architecture

```
Browser (Angular SPA)
    │  HTTPS  →  /api/*  (REST + SSE /events)
    ▼
Express API (CORS, Helmet, rate limits, Passport)
    │
    ├── PostgreSQL (profiles, slots, bookings, vehicles, trainers, settings, …)
    └── node-cron (optional: inactivity scan, auto slot generation)
```

- **Single Page Application**: routes like `/`, `/booking`, `/profile`, `/my-bookings`, `/admin/*`.
- **API** base path: `/api` (e.g. `https://your-api.com/api/bookings`).
- **Real-time**: optional `GET /api/events` (Server-Sent Events) for slot refresh; clients fall back to polling.

Database schema is defined and evolved under `supabase/migrations/*.sql` (run in order on your Postgres instance).

---

## 4. Booking Flow (Step by Step)

1. User opens **Book Now** (`/booking`) and picks a **date** (slots load for that day).
2. User selects an **available slot** (not full, not disabled, within visibility rules).
3. If not signed in, they are prompted to **Sign in with Google**.
4. In the modal they choose **trainer**, **vehicle**, enter **10-digit mobile** (must match profile when profile already has a real number), complete captcha, confirm.
5. API validates: auth, profile rules, optional student recognition / entitlements (if tables exist), **single active booking**, vehicle capacity, trainer not double-booked, time windows, inactive customer block, etc.
6. On success: booking row inserted, slot counts updated, optional confirmation email/WhatsApp, profile stats updated (`last_booking_date`, weekly counters where functions exist).
7. User can **cancel** from **My Bookings** within the configured hours-before-slot policy.
8. After cancel, a **new** booking is allowed (still subject to weekly limits and entitlements).

---

## 5. Slot Generation Logic (Cron + Automation)

- **Admin** can generate slots for a date via admin APIs/UI (see admin slot management).
- **Automated nightly job** (Express, `node-cron`): default expression `AUTO_SLOT_CRON` (e.g. midnight **Asia/Kolkata**). It calls internal logic to ensure slots exist for upcoming days (implementation in backend — `runNightlyAutoGeneration`).
- **Visibility**: slots may use `is_visible` and time-based rules so bookings open only inside the configured window before class start.
- **Disable automation**: set `DISABLE_AUTO_SLOT_CRON=1`. For one-off run at startup: `AUTO_SLOT_RUN_ON_START=1`.
- **Inactivity cron**: `INACTIVITY_CRON` (default daily); disable with `DISABLE_INACTIVITY_CRON=1`. See `.env.example`.

---

## 6. Admin Flow

1. Open **`/admin/login`**, sign in with **admin/superadmin** credentials (JWT stored client-side for admin UI).
2. **Dashboard** — overview metrics (if configured).
3. **Slots** — view/generate slots, adjust day, capacity-related tools.
4. **Bookings** — list, filter, update status, delete where allowed.
5. **Trainers / Vehicles / Users** — CRUD or status updates per role.
6. **Settings** — site copy, contact, social links.
7. **Audit logs** — review admin actions where logging is enabled.
8. **Reactivate customers** — clear `inactive_blocked` on users when applicable (see API / admin UI).

---

## 7. API Overview (Important Endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/me` | Current user (JWT / cookie) |
| POST | `/api/auth/login` | Admin email/password → JWT |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/profiles/me` | Profile (alias pattern) |
| PUT | `/api/profiles/me` | Update profile (e.g. phone) |
| GET | `/api/slots` | List slots (query: date, etc.) |
| GET | `/api/trainers` / `.../available-for-slot/:slotId` | Trainers |
| GET | `/api/vehicles` | Active vehicles |
| POST | `/api/bookings` | Create booking (auth) |
| GET | `/api/bookings/my-bookings` | Logged-in user’s bookings |
| PUT | `/api/bookings/:id/cancel` | Cancel booking |
| GET | `/api/settings` | Public site settings |
| GET | `/api/events` | SSE stream (optional) |
| `*` | `/api/admin/*` | Admin-only (bookings, users, slots, …) |
| `*` | `/api/admin-management/*` | Extended admin management (if deployed) |

Full list changes with releases; treat this as the **minimum mental model** for integration.

---

## 8. Environment Variables

Create **`backend/.env`** from **`backend/.env.example`**. Never commit `.env`.

**Minimum for local API**

- Database: `DATABASE_URL` **or** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` (strong random string)
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (e.g. `http://localhost:3000/api/auth/google/callback`)
- `FRONTEND_URL` (e.g. `http://localhost:4200`) for OAuth redirect and CORS
- `SESSION_SECRET` (sessions)

**Production**

- Set `NODE_ENV=production`
- Use HTTPS URLs for `FRONTEND_URL`, `GOOGLE_CALLBACK_URL`
- Optional: `FRONTEND_URL_PREVIEW` for preview deployments (CORS)
- SMTP / `ADMIN_ALERT_EMAIL` for emails
- Cron tunables: see `.env.example`

---

## 9. Local Setup

### Prerequisites

- Node.js 18+ (or LTS aligned with Angular 20)
- PostgreSQL 14+
- Google Cloud OAuth client (Web application)

### Database

1. Create a database user and empty database.
2. Apply migrations in lexical order:

   ```bash
   # Example: run each file with psql or use backend helper
   psql "$DATABASE_URL" -f supabase/migrations/20251102124908_init_schema.sql
   # … continue for all files in supabase/migrations/
   ```

   Or use `backend/apply_migration.js` for a single file (see script header).

### Backend

```bash
cd backend
cp .env.example .env   # then edit values
npm install
npm start              # default port 3000
```

### Frontend

```bash
# repo root
npm install
```

Edit `src/environments/environment.ts` so `apiUrl` points to your API (e.g. `http://localhost:3000/api`).

```bash
npm start              # ng serve, default 4200
```

Open `http://localhost:4200`.

---

## 10. Production Deployment

### Frontend (Vercel / Netlify)

1. Connect the Git repo; set **build command** to `npm run build` (or `npx ng build`) and **output directory** to `dist/demo/browser` (matches `angular.json` `outputPath` + application builder layout).
2. Set environment / build-time config so **production** `environment.prod.ts` has the **live API** `apiUrl`.
3. Ensure SPA rewrites send unknown paths to `index.html` (Vercel `vercel.json` is included in this repo as a reference).
4. After each release, users should get fresh bundles; service worker (if enabled) is configured to avoid caching hashed JS incorrectly — still do a hard refresh when testing.

### Backend (Render / Railway / VPS)

1. Set all **required** env vars (section 8).
2. `NODE_ENV=production`
3. Start command: `node server.js` or `npm start` from `backend/`.
4. Ensure Postgres is reachable (TLS for managed DBs; `DATABASE_URL` with `sslmode=require` where needed).
5. **CORS**: `FRONTEND_URL` must match the deployed SPA origin exactly (no trailing slash mismatch).

### Database (cloud)

- Use Neon, RDS, Supabase Postgres, etc.
- Run **all** migrations once on an empty DB; for existing DBs, run only missing migration files.
- **Data wipe** (bookings/slots/entitlements/audit only): see `scripts/database/clear_transactional_data.sql` (maintenance window, backup first).

---

## 11. Common Errors & Fixes

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| CORS error in browser | `FRONTEND_URL` wrong or missing preview origin | Add exact origin in server CORS config / env |
| `Failed to fetch dynamically imported module` | Old cached service worker or CDN | Deploy new SW; hard refresh; `vercel.json` cache headers on HTML/SW |
| Google OAuth redirect mismatch | Callback URL not in Google Console | Match `GOOGLE_CALLBACK_URL` to authorized redirect URIs |
| `JWT_SECRET` / 401 on `/api/auth/me` | Secret missing or token expired | Set `JWT_SECRET`; user signs in again |
| Postgres SSL errors (Neon) | Local dev without SSL | Set `DB_SSL=true` for local against Neon, or use `DATABASE_URL` with ssl |
| Booking always rejected “inactive” | `inactive_blocked` on profile | Admin clears flag or run inactivity policy intentionally |
| “Slot full” / capacity | Vehicle or slot capacity | Adjust vehicle `max_per_slot` / slot generation; check `slot_vehicle_capacity` |
| `used_slots` out of sync | Manual DB edits | Run `scripts/database/reconcile_student_entitlements.sql` |

---

## 12. Repository Layout (short)

```
angular app/          → src/, angular.json
backend/              → Express entry server.js, routes/, services/
supabase/migrations/  → SQL migrations (source of truth for schema)
scripts/database/     → Operational SQL (clear data, reconcile entitlements)
```

---

## 13. License & support

Use and deploy according to your organization’s policy. For schema questions, rely on `supabase/migrations` and this README first.
