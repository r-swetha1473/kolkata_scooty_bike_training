# Production Hardening & Release Audit

**Project:** Kolkata Scooty Bike Training  
**Audit date:** 2026-06-10  
**Scope:** Full repository — audit only, **no deletions performed**  
**Current stack:** Angular (Vercel) + Node/Express (Render) + Neon PostgreSQL  

> **Policy:** This report lists every proposed change. Do not delete or refactor until each item is reviewed and approved.

---

## Executive Summary

| Area | Score | Status |
|------|-------|--------|
| Repository hygiene | 62/100 | Needs cleanup |
| Folder structure | 55/100 | Functional, not standardized |
| Security | 68/100 | Gaps in settings exposure, logging, secrets in scripts |
| Database schema | 74/100 | Migrations exist; drift risk remains |
| API design | 72/100 | Dead routes; fat handlers |
| Frontend | 65/100 | **Build broken**; duplicate HTTP layers |
| Production readiness | 78/100 | Core flows work on Render/Vercel |
| Hostinger readiness | 60/100 | Guide prepared separately |

**Overall production readiness: 72/100 — CONDITIONAL GO**

**Blockers before final release:**
1. **TypeScript build failure** — `booking.component.ts` references undefined `getToday()` (should be `getKolkataToday()`)
2. Gate or remove investigation `console.log` in production backend (especially `[Auth Debug]`)
3. Confirm all June 2026 migrations applied on production DB (`verify_migrations.js`)

---

## Phase 1 — Repository Cleanup

### 1.1 Safe to Delete (after archiving useful patterns)

#### Backend scripts — temporary investigation (13 files)

| File | Reason |
|------|--------|
| `backend/scripts/debug_vehicle_create.js` | One-off vehicle POST debug |
| `backend/scripts/test_users_query.js` | Ad-hoc SQL test |
| `backend/scripts/check_inactive_blocked_schema.js` | Superseded by `verify_inactive_blocked_production.js` |
| `backend/scripts/cutover_verify.js` | Old Render host cutover |
| `backend/scripts/wait_for_deploy.js` | Poll until commit `74ec45c` |
| `backend/scripts/wait_for_oauth_deploy.js` | Poll until commit `e757ec2` |
| `backend/scripts/verify_vercel_deploy.js` | FE chunk polling |
| `backend/scripts/verify_deployed_auth_chunk.js` | Specific chunk inspection |
| `backend/scripts/verify_vehicle_fix_deployed.js` | Poll until commit `a8e8966` |
| `backend/scripts/check_vercel_bundle.js` | FE bundle inspection |
| `backend/scripts/check_frontend_oauth_bundle.js` | OAuth bundle inspection |
| `backend/scripts/scan_vercel_env.js` | FE env string scan |
| `backend/scripts/final_release_verify.js` | Release-specific one-off |
| `backend/scripts/verify_users_production_final.js` | Duplicate of `verify_users_production.js` |

#### Frontend — unused code

| File | Reason |
|------|--------|
| `src/app/admin/pages/slots-info/slots-info.component.ts` | Not in routes; zero imports |
| `src/app/services/booking.service.ts` | No imports anywhere in `src/app` |

#### Dead API surface (backend)

| Route file | Reason |
|------------|--------|
| `backend/routes/adminManagement.js` | Zero frontend references; superseded by `/api/admin/admins` |

#### Deprecated endpoints (already 410)

| Endpoint | Action |
|----------|--------|
| `GET/POST/PUT/DELETE /api/admin/slots/*` | Keep 410 handler until clients confirmed gone, then remove mount |

---

### 1.2 Review Before Delete

| Item | Concern |
|------|---------|
| `backend/routes/recognition.js` | Backend-only; bookings probe table existence — no FE UI |
| `backend/routes/ratings.js` | `ApiService.submitRating()` exists but no UI calls it; schema mismatch with migration |
| `GET /api/admin/customers` + `/customers/export` | Not used by Angular; may be used manually/ops |
| `GET /api/admin/bookings/overdue` | Not called directly; overdue data comes via `/admin/stats` |
| `POST /api/slots/generate-daily` | Legacy alias of `/generate` |
| `GET /api/settings/all` | Used by `SettingsService`; overlaps `/admin/settings` |
| `backend/env.example.txt` | Duplicate of `.env.example` |
| `audit_logs` table | Legacy fallback in `admin.js`; keep until `admin_audit_log` confirmed everywhere |
| `admins` table + `adminManagement.js` | Parallel RBAC model — confirm no external consumers |
| Slot breakdown columns (`electric_capacity`, etc.) | Deprecated in backend; still shown in admin UI |
| `scripts/database/neon_production_recovery.sql` | Keep for ops; not delete |

#### Unused service methods (frontend)

| Service | Unused methods |
|---------|----------------|
| `ApiService` | `currentUser$`, `getAllBookings()`, `getDashboardStats()`, `getAllUsers()`, `signInWithGoogle()` |
| `AdminService` | `getStats()` (duplicate of `getDashboardStats()`) |
| `TrainerService` | `getTrainerById`, `createTrainer`, `updateTrainer`, `deleteTrainer`, `toggleOnDuty`, `toggleActive` |

---

### 1.3 Must Keep

#### Backend runtime

- All route files except `adminManagement.js` (pending review)
- All 15 services under `backend/services/`
- Middleware: `auth.js`, `permissions.js`, `adminAccess.js`, `errorHandler.js`, `bookingPayload.js`
- Validators (7 files)
- Utils including `profileInactive.js`, `googleOAuth.js`, `authCookie.js`
- `backend/apply_migration.js`, `backend/create_admin.js`

#### Backend scripts — production utilities (keep)

| Script | Purpose |
|--------|---------|
| `production_validation.js` | DB + API readiness |
| `production_qa_audit.js` | Full prod QA |
| `e2e_production_verify.js` | E2E verification |
| `post_deploy_smoke.js` | Post-deploy smoke |
| `live_prod_verify.js` | Read-only prod checks |
| `verify_migrations.js` | Schema verification |
| `verify_inactive_blocked_production.js` | Feature verification |
| `verify_slots_production.js` | Slots/capacity |
| `verify_google_oauth_production.js` | OAuth checks |
| `verify_auth_session_flow.js` | Auth flow |
| `verify_users_api.js` / `verify_users_production.js` | Users module |
| `verify_trainers_vehicles_production.js` | CRUD verification |
| `slot_capacity_validation.js` | Capacity validation |
| `apply_slot_capacity_migration.js` | Targeted migration |
| `db_go_live_check.js` | Go-live DB check |
| `overdue_report.js` | Ops reporting |
| `promote_superadmin.js` | Bootstrap ops |
| `check_db.js`, `check_schema.js` | Dev diagnostics |
| `dashboard_validation.js`, `booking_search_validation.js` | Dev SQL validation |
| `analyze_db_mismatches.js` | Schema drift analyzer |

#### Migrations

- All 32 files in `supabase/migrations/` — single source of truth
- `scripts/database/apply_all_migrations.ps1` — canonical apply order

#### Frontend

- All routed components (25 active)
- `AuthService`, `AdminService`, `HttpService`, `SlotService`, `SettingsService`, `NotificationService`, `PermissionService`, `ToastService`
- All guards
- `route-loaders.ts` (chunk retry)

---

### 1.4 Console.log / Debug Logging

#### Backend runtime (gate or remove for production)

| File | Issue | Severity |
|------|-------|----------|
| `middleware/auth.js` | `[Auth Debug] /auth/me` — logs host, origin, cookies, email; **not gated by NODE_ENV** | **Critical** |
| `routes/bookings.js` | `[Bookings][POST]` request dumps | High |
| `config/passport.js` | `[Google Auth]` logs emails/IDs on every OAuth login | High |
| `routes/slots.js` | `[Slots Debug]`, `[slot auto fallback:*]` | Medium |
| `utils/googleOAuth.js` | `[Google OAuth Debug]` | Medium |
| `routes/admin.js` | `[Admin] GET /users` verbose logging | Low |
| `middleware/errorHandler.js` | `[Schema]` logging (acceptable for ops) | Keep |

#### Frontend

| File | Line | Issue |
|------|------|-------|
| `admin/pages/users/users.component.ts` | 246 | `console.log('[AdminUsers] loaded', ...)` |
| `main.ts` | 27 | `console.error` on bootstrap failure — **keep** |

**Proposed change (listed, not applied):** Wrap investigation logs in `if (process.env.LOG_DEBUG === '1')` or remove; set `NODE_ENV=production` on Render explicitly.

---

## Phase 2 — Folder Structure Standardization

### Current vs Target

#### Backend (current)

```
backend/
├── config/          ✓ passport.js, app.config.js
├── middleware/      ✓
├── routes/          ✓ (11 files — fat routes)
├── services/        ✓ (15 files)
├── utils/           ✓
├── validators/      ✓
├── scripts/         ✓ (40 files — needs pruning)
├── test/            partial (2 files)
├── server.js        root clutter
├── db.js            root clutter
├── app.config.js    DUPLICATE of config/app.config.js
└── events.js        root clutter
```

#### Backend (target)

```
backend/
├── config/
├── middleware/
├── routes/          thin — delegate to services
├── services/
├── repositories/    NEW — optional; extract SQL from routes
├── utils/
├── validators/
├── scripts/         ops + verify only
├── migrations/      symlink or copy from supabase/migrations
└── tests/
```

**Fat routes to refactor (priority order):**

| File | Lines | Extract to |
|------|-------|------------|
| `routes/bookings.js` | ~1050 | `bookingCreation.service.js` |
| `routes/admin.js` | ~1552 | `adminUsers.service.js`, `adminTrainers.service.js` |
| `routes/slots.js` | ~1139 | Already partial; move CRUD to `slotManagement.service.js` |
| `routes/adminManagement.js` | ~628 | Delete if route retired |

**Config conflict — must resolve:**

| File | `maxCapacity` |
|------|---------------|
| `backend/app.config.js` | `5` |
| `backend/config/app.config.js` | `MAX=50` via `SLOT_CAPACITY` |

#### Frontend (current)

```
src/app/
├── admin/           layout + pages
├── components/      captcha, toast
├── guards/
├── pages/           flat public pages
├── services/        11 services (overlapping)
└── utils/
```

#### Frontend (target)

```
src/app/
├── core/            AuthService, HttpService, guards, interceptors
├── shared/          captcha, toast, utils, pipes
└── features/
    ├── home/
    ├── auth/
    ├── booking/
    ├── profile/
    └── admin/
```

**Circular dependency risk:** Low today — flat imports; restructuring should use `core → shared → features` one-way flow.

---

## Phase 3 — Security Audit

### Findings

| # | Finding | Severity | Recommendation |
|---|---------|----------|----------------|
| S1 | `GET /api/settings/` and `GET /api/settings/:key` are **public** — all site settings exposed | **High** | Require auth for non-public keys or whitelist public keys |
| S2 | `SESSION_SECRET` fallback `'your-secret-key'` in `server.js` | **High** | Fail startup if unset in production |
| S3 | `[Auth Debug]` logs on every `/auth/me` in production | **High** | Gate or remove |
| S4 | `admin@kolkatascotty.com` / `admin123` hardcoded in 20+ script files | **Medium** | Remove defaults; use env vars only |
| S5 | `create_admin.js` default password `admin123` | **Medium** | Require env or prompt |
| S6 | CORS allows `*.kolkata-scooty-bike-training.vercel.app` wildcard | **Medium** | Scope to known preview URLs |
| S7 | CORS allows requests with no `Origin` header | **Medium** | Restrict in production |
| S8 | `GET /api/events` SSE — no authentication | **Medium** | Add token check or IP allowlist |
| S9 | Google OAuth routes not rate-limited | **Low** | Add `strictLimiter` |
| S10 | `rejectUnauthorized: false` for DB SSL (Neon) | **Low** | Acceptable for Neon; document |
| S11 | Error handler returns stack traces when `NODE_ENV` unset | **Medium** | Set `NODE_ENV=production` on Render |
| S12 | `publicLimiter` 5000 req/15min very permissive | **Low** | Tune down for polling endpoints |

### Verified good practices

| Area | Status |
|------|--------|
| SQL injection | ✓ All queries use parameterized `$N` placeholders |
| JWT | ✓ Secret required; 7-day expiry; Bearer + httpOnly cookie |
| Cookie auth | ✓ `httpOnly`, `secure` in prod, `sameSite: 'none'` for cross-origin |
| Helmet | ✓ Enabled with defaults |
| Rate limiting | ✓ Login 5/15m; strict 100/15m on bookings/admin |
| Secrets in repo | ✓ `.env` gitignored; `.env.example` has placeholders only |
| Hardcoded prod URLs | ⚠ Present as fallbacks in 6+ frontend service files |

### OAuth flow

| Step | Status |
|------|--------|
| Callback URL auto-resolve from `RENDER_EXTERNAL_URL` | ✓ Fixed |
| Token in redirect `?token=` for SPA | ✓ |
| httpOnly cookie for session | ✓ |
| Passport debug logging | ⚠ Too verbose |

---

## Phase 4 — Database Audit

### Tables inventory

| Table | Status | Notes |
|-------|--------|-------|
| `profiles` | **Keep** | Core auth; `inactive_blocked` now on prod |
| `bookings` | **Keep** | Core |
| `slots` | **Keep** | Core |
| `trainers` | **Keep** | Core |
| `vehicles` | **Keep** | Dynamic capacity model |
| `slot_vehicle_capacity` | **Keep** | Current capacity model |
| `settings` | **Keep** | Site + auto capacity setting |
| `admin_audit_log` | **Keep** | Primary audit |
| `admin_notifications` | **Keep** | Admin notification center |
| `admin_notification_reads` | **Keep** | Read tracking |
| `sub_admin_permissions` | **Keep** | RBAC (not `admin_permissions`) |
| `student_recognition` | **Keep** | Optional feature |
| `student_entitlements` | **Keep** | Booking entitlements |
| `ratings` | **Review** | Schema mismatch: migration `rating`/`comment` vs code `rating_value`/`comments` |
| `admins` | **Review** | Parallel admin model; only `adminManagement.js` |
| `audit_logs` | **Review → deprecate** | Legacy fallback only |
| `notifications` | **N/A** | Does not exist (use `admin_notifications`) |

### Columns — cleanup candidates

| Column(s) | Verdict | Notes |
|-----------|---------|-------|
| `slots.electric_capacity`, `petrol_capacity`, `bike_capacity` | **Needs migration** | Legacy; constraint `slots_vehicle_capacity_check` may conflict |
| `bookings.vehicle_type` | **Needs migration** | NOT NULL in migration; inserts use `vehicle_id` only |
| `bookings.can_cancel`, `cancellation_deadline` | **Safe to remove** (later) | Zero code references |
| `vehicles.type`, `vehicle_subtype`, `description` | **Keep for now** | Legacy display; default added in `20260610120000` |
| `profiles.google_id` | **Keep** | Still used alongside `provider_id` |

### Index health

| Index | Status |
|-------|--------|
| `idx_profiles_inactive_blocked_customers` | ✓ Applied |
| `idx_profiles_phone_unique` | ✓ Partial unique |
| `idx_bookings_slot_trainer_active` | ✓ |
| `idx_sub_admin_permissions_profile` | Verify on prod |
| Duplicate slot uniqueness indexes | **Review** — multiple partial indexes from incremental migrations |

### Migration status

| Migration | Production status |
|-----------|-------------------|
| `20260406000000` inactive_blocked | ✓ Applied 2026-06-10 |
| `20260610140000` slot capacity 1–100 | ✓ Applied |
| `20260609120000–15000` RBAC + notifications | **Verify** via `verify_migrations.js` |
| `20260610120000` vehicles type default | **Verify** |

**Always use** `scripts/database/apply_all_migrations.ps1` order — never alphabetical sort.

---

## Phase 5 — API Inventory

### Legend

- **Auth:** ✓ = required, ○ = public, ◐ = optional
- **FE:** ✓ = used by Angular, ✗ = not used, ◐ = partial

### Auth & Profiles

| Route | Method | Auth | FE | Safe to remove? |
|-------|--------|------|----|-----------------|
| `/api/auth/login` | POST | ○ | ✓ | No |
| `/api/auth/google` | GET | ○ | ✓ | No |
| `/api/auth/google/callback` | GET | ○ | ✓ | No |
| `/api/auth/logout` | POST | ◐ | ✓ | No |
| `/api/auth/me` | GET | ✓ | ✓ | No |
| `/api/profiles/me` | GET | ✓ | ✓ | No |
| `/api/profiles/me` | PUT | ✓ | ✓ | No |

### Bookings & Slots

| Route | Method | Auth | FE | Safe to remove? |
|-------|--------|------|----|-----------------|
| `/api/bookings` | POST | ✓ | ✓ | No |
| `/api/bookings/my-bookings` | GET | ✓ | ✓ | No |
| `/api/bookings/:id/update` | PUT | ✓ | ✓ | No |
| `/api/bookings/:id/cancel` | PUT | ✓ | ✓ | No |
| `/api/bookings/slot/:slotId/status` | GET | ✓ | ◐ | No |
| `/api/slots/date/:date` | GET | ○ | ✓ | No |
| `/api/slots/available` | GET | ○ | ✓ | No |
| `/api/slots/generate` | POST | ✓ | ✓ | No |
| `/api/slots/generate-daily` | POST | ✓ | ✗ | Review (alias) |
| `/api/slots/generate-missing` | POST | ✓ | ✗ | Review |
| `/api/slots/next-available-date` | GET | ○ | ✓ | No |
| `/api/slots/:id/vehicle-capacity` | PUT | ✓ | ✓ | No |
| `/api/slots/*` (CRUD) | various | ✓ | ✓ | No |

### Admin (used by frontend)

| Route | Method | Auth | FE | Safe to remove? |
|-------|--------|------|----|-----------------|
| `/api/admin/stats` | GET | ✓ admin | ✓ | No |
| `/api/admin/dashboard` | GET | ✓ admin | ✗ | Review (ApiService only) |
| `/api/admin/users` | GET/POST/PUT/DELETE | ✓ | ✓ | No |
| `/api/admin/bookings` | GET | ✓ | ✓ | No |
| `/api/admin/bookings/:id/status` | PUT | ✓ | ✓ | No |
| `/api/admin/trainers` | CRUD | ✓ | ✓ | No |
| `/api/admin/vehicles` | via `/api/vehicles` | ✓ | ✓ | No |
| `/api/admin/settings` | GET/PUT | ✓ | ✓ | No |
| `/api/admin/slots/recalculate-capacity` | POST | ✓ | ✓ | No |
| `/api/admin/notifications` | GET | ✓ | ✓ | No |
| `/api/admin/audit-logs` | GET | ✓ superadmin | ✓ | No |
| `/api/admin/sub-admins` | CRUD | ✓ superadmin | ✓ | No |
| `/api/admin/admins` | CRUD | ✓ superadmin | ✓ | No |
| `/api/admin/change-password` | PUT | ✓ | ✓ | No |
| `/api/admin/slots/*` | * | ✓ | ✗ | Already 410 — remove later |

### Unused / dead endpoints

| Route | Method | Auth | FE | Safe to remove? |
|-------|--------|------|----|-----------------|
| `/api/admin-management/*` | all | ✓ | ✗ | **Yes** (after confirmation) |
| `/api/admin/customers` | GET | ✓ | ✗ | Review |
| `/api/admin/customers/export` | GET | ✓ | ✗ | Review |
| `/api/admin/bookings/overdue` | GET | ✓ | ✗ | Review |
| `/api/recognition/*` | all | ✓ | ✗ | Review |
| `/api/ratings/trainer/:id` | GET | ○ | ✗ | Review |
| `/api/settings/all` | GET | ○ | ✓ | Review (public exposure) |

### Infrastructure

| Route | Method | Auth | FE | Notes |
|-------|--------|------|----|-------|
| `/health` | GET | ○ | ✗ | Keep |
| `/api/version` | GET | ○ | ✗ | Keep |
| `/api/events` | GET | ○ | ✓ SSE | Add auth |

---

## Phase 6 — Frontend Audit

### Build status

```
npm run build -- --configuration=production
FAILED: TS2304 Cannot find name 'getToday' in booking.component.ts:570,577,584
```

**Fix required:** Replace `getToday()` with `getKolkataToday()` (already imported).

### Bundle analysis

| Metric | Value |
|--------|-------|
| Production build | **BLOCKED** by TS error |
| Bundle budgets in `angular.json` | **None configured** |
| Lazy loading | ✓ All routes use `loadComponent` |
| Initial bundle concern | `AppComponent` ~613 lines inline template + ~380 lines CSS (eager) |
| Global CSS | `theme.bmw.css` ~1119 lines + `admin.design-system.css` ~678 lines on **every page** |

### Lazy loading map

All 20 routed pages are lazy-loaded via `loadComponent` + `loadWithRetry`. Admin shell (`AdminLayoutComponent`) eager-imports header/footer/toast.

### Duplicate HTTP / auth

| Issue | Impact |
|-------|--------|
| `AuthService` + `ApiService` both call `/auth/me` on startup | 2× auth requests every page load |
| 5 parallel HTTP wrappers | Inconsistent headers/credentials |
| `SettingsService` + `AppComponent` both fetch settings | Duplicate on boot |

### Subscription cleanup

| Component | Status |
|-----------|--------|
| `BookingComponent` | ✓ `OnDestroy` cleans interval + EventSource |
| `AdminSlotsComponent` | ✓ EventSource cleanup |
| `ToastComponent`, `AdminHeaderComponent` | ✓ Manual unsubscribe |
| `ContactComponent`, `ProfileComponent` | ⚠ No cleanup on `settings$` / `userProfile$` |

### Recommended bundle optimizations (listed, not applied)

1. Add `budgets` to `angular.json` (initial: 500kb warning, 1mb error)
2. Lazy-load `admin.design-system.css` with admin layout only
3. Consolidate HTTP into single `HttpService` + interceptor
4. Remove dead `BookingService`, `AdminSlotsInfoComponent`
5. Split `AppComponent` template to external HTML/CSS

---

## Phase 7 — Production Readiness Matrix

### Super Admin modules

| Module | API | UI | Prod verified |
|--------|-----|----|----|
| Dashboard | `/admin/stats` | ✓ | ✓ |
| Users | `/admin/users` | ✓ | ✓ |
| Trainers | `/admin/trainers` | ✓ | ✓ |
| Vehicles | `/vehicles` | ✓ | ✓ |
| Slots | `/slots/*` | ✓ | ✓ |
| Bookings | `/admin/bookings` | ✓ | ✓ |
| Notifications | `/admin/notifications` | ✓ | ✓ |
| Settings | `/admin/settings` | ✓ | ✓ |
| Audit Logs | `/admin/audit-logs` | ✓ | ✓ |
| Sub Admins | `/admin/sub-admins` | ✓ | ✓ |

### Sub Admin

| Check | Status |
|-------|--------|
| Permission model (`sub_admin_permissions`) | ✓ Implemented |
| `permissionGuard` on routes | ✓ |
| Automated E2E login | ✗ Blocked — no test password |
| Restricted module access | Manual verify needed |

### Customer flows

| Flow | Status | Notes |
|------|--------|-------|
| Google Login | ✓ | OAuth redirect fixed; manual browser confirm |
| Profile | ✓ | |
| Booking page / slots | ✓ | Capacity = 6 verified |
| Create booking | ✓ | `inactive_blocked` migration applied |
| Reschedule | ◐ | API exists; manual browser test |
| Cancel | ◐ | API exists; manual browser test |
| My Bookings | ✓ | `formatted_slot_time` added |

---

## Phase 8 — Hostinger Migration

See **`HOSTINGER_DEPLOYMENT_GUIDE.md`** for full checklist including:
- `.env` template
- PM2 config
- Nginx reverse proxy
- SSL checklist
- Backup / rollback strategy

---

## Phase 9 — Final Report

### 1. Files proposed for removal (not yet deleted)

**Backend scripts (14):** Listed in Phase 1.1  
**Frontend (2):** `slots-info.component.ts`, `booking.service.ts`  
**Backend routes (1):** `adminManagement.js` (pending review)

### 2. Unused code summary

- 1 unused Angular component
- 1 unused Angular service
- ~15 unused service methods
- 7 dead `/api/admin-management` endpoints
- 13+ temporary investigation scripts

### 3. Bundle size before/after

| | Status |
|---|--------|
| Before cleanup | **Cannot measure** — production build fails on `getToday` |
| After cleanup (estimated) | 5–15% reduction from dead code + admin CSS lazy-load |
| Action | Fix TS error, add budgets, rebuild |

### 4. Security findings (top 5)

1. Public settings API exposes all keys
2. Session secret hardcoded fallback
3. Auth debug logging in production
4. Test credentials in 20+ repo files
5. Unauthenticated SSE `/api/events`

### 5. Database findings (top 5)

1. `inactive_blocked` migration was missing — now applied
2. Ratings schema mismatch (migration vs runtime)
3. Legacy `vehicle_type` NOT NULL may conflict with current inserts
4. Slot breakdown columns + constraint drift
5. June 2026 migrations need automated verification on prod

### 6. API findings (top 5)

1. `/api/admin-management` entirely unused by frontend
2. `POST /api/bookings` is 600+ lines — needs service extraction
3. Public `GET /api/settings` over-exposes data
4. Duplicate config causes capacity limit confusion (5 vs 50 vs 100)
5. `/api/admin/dashboard` vs `/api/admin/stats` overlap

### 7. Production readiness score

**72/100 — CONDITIONAL GO**

| Criterion | Weight | Score |
|-----------|--------|-------|
| Core booking flow | 20% | 90 |
| Admin panel | 20% | 85 |
| Auth/OAuth | 15% | 80 |
| Schema/migrations | 15% | 75 |
| Security | 15% | 65 |
| Code hygiene | 10% | 55 |
| Build/deploy | 5% | 40 |

### 8. Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema drift on Hostinger DB | Medium | High | Run `apply_all_migrations.ps1` + `verify_migrations.js` |
| Build failure on deploy | **High** | High | Fix `getToday` immediately |
| Credential leak via logs | Medium | High | Remove auth debug logs |
| Legacy capacity constraint blocks slots | Low | High | Verify `20260610140000` applied |
| Sub-admin permission bypass | Low | Medium | Manual RBAC test |

### 9. Recommended deployment checklist

#### Pre-release (before any deletion)

- [ ] Fix `getToday` → `getKolkataToday` in `booking.component.ts`
- [ ] Confirm `npm run build -- --configuration=production` passes
- [ ] Run `node backend/scripts/verify_migrations.js` against production DB
- [ ] Run `node backend/scripts/e2e_production_verify.js`
- [ ] Set `NODE_ENV=production` on Render
- [ ] Rotate secrets shared in chat (JWT, DB, OAuth, SMTP)

#### Cleanup phase (after approval)

- [ ] Delete 14 investigation scripts (Phase 1.1)
- [ ] Remove `adminManagement.js` route mount (after confirmation)
- [ ] Remove `AdminSlotsInfoComponent`, `BookingService`
- [ ] Gate/remove debug console.log in backend
- [ ] Remove `console.log` from `users.component.ts`
- [ ] Consolidate `app.config.js` duplicates

#### Security hardening

- [ ] Restrict public settings endpoint
- [ ] Remove `SESSION_SECRET` fallback
- [ ] Add rate limit to OAuth routes
- [ ] Authenticate SSE `/api/events`
- [ ] Remove hardcoded `admin123` from scripts

#### Hostinger migration

- [ ] Follow `HOSTINGER_DEPLOYMENT_GUIDE.md`
- [ ] Export Neon DB backup before migration
- [ ] Run full migration set on new PostgreSQL instance
- [ ] Update DNS + SSL
- [ ] Run post-deploy smoke tests

---

## Appendix: Proposed Changes Log

> No production behavior has been modified during this audit. All items above are recommendations pending your approval.

| # | Change | Type | Production impact |
|---|--------|------|-------------------|
| 1 | Delete investigation scripts | Cleanup | None |
| 2 | Remove `adminManagement.js` | Cleanup | None if unused |
| 3 | Gate debug logs | Security | Less log noise; no API change |
| 4 | Fix `getToday` build error | Bug fix | Required for deploy |
| 5 | Restrict `/api/settings` | Security | **Breaking** for public settings consumers |
| 6 | Remove `admin.design-system.css` from global | Performance | None functional |
| 7 | Consolidate HTTP services | Refactor | Test thoroughly |
| 8 | Extract `bookingCreation.service` | Refactor | Test booking flow |
| 9 | Ratings schema alignment migration | Database | Requires migration + deploy |
| 10 | Drop legacy slot breakdown columns | Database | Requires UI update first |

---

*Generated by production audit scan. Review each section before executing cleanup.*
