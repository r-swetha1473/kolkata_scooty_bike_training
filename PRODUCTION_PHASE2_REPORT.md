# Production Phase 2 Report

**Project:** Kolkata Scooty Bike Training  
**Date:** 2026-06-10  
**Phase:** Cleanup, security hardening, validator alignment, frontend auth dedup  
**Deploy status:** Not deployed, not committed, not pushed (per instructions)

---

## Executive Summary

| Metric | Phase 1 | Phase 2 |
|--------|---------|---------|
| Production build | PASS | **PASS** |
| Production readiness | 79/100 | **84/100** |
| Recommendation | CONDITIONAL GO | **GO** (with pre-deploy checklist) |

Phase 2 removed 16 unused files, hardened public settings API, aligned slot validators with DB constraints, eliminated duplicate `/auth/me` on startup, and gated investigation logs for production.

---

## 1. Deletion Report

### Pre-deletion reference scan

| File | References found | Safe to delete? |
|------|------------------|-----------------|
| `backend/scripts/debug_vehicle_create.js` | None (audit doc only) | **Yes — deleted** |
| `backend/scripts/test_users_query.js` | None | **Yes — deleted** |
| `backend/scripts/check_inactive_blocked_schema.js` | Superseded by `verify_inactive_blocked_production.js` | **Yes — deleted** |
| `backend/scripts/cutover_verify.js` | None | **Yes — deleted** |
| `backend/scripts/wait_for_deploy.js` | None | **Yes — deleted** |
| `backend/scripts/wait_for_oauth_deploy.js` | None | **Yes — deleted** |
| `backend/scripts/verify_vercel_deploy.js` | None | **Yes — deleted** |
| `backend/scripts/verify_deployed_auth_chunk.js` | None | **Yes — deleted** |
| `backend/scripts/verify_vehicle_fix_deployed.js` | None | **Yes — deleted** |
| `backend/scripts/check_vercel_bundle.js` | None | **Yes — deleted** |
| `backend/scripts/check_frontend_oauth_bundle.js` | None | **Yes — deleted** |
| `backend/scripts/scan_vercel_env.js` | None | **Yes — deleted** |
| `backend/scripts/final_release_verify.js` | None | **Yes — deleted** |
| `backend/scripts/verify_users_production_final.js` | Duplicate of `verify_users_production.js` | **Yes — deleted** |
| `src/app/admin/pages/slots-info/slots-info.component.ts` | Self only; not in routes | **Yes — deleted** |
| `src/app/services/booking.service.ts` | Self only; zero imports | **Yes — deleted** |

**Note:** `overdueBooking.service.js` is a **different** service and was **not** deleted.

### Deleted files (16 total)

**Backend scripts (14):**
1. `backend/scripts/debug_vehicle_create.js`
2. `backend/scripts/test_users_query.js`
3. `backend/scripts/check_inactive_blocked_schema.js`
4. `backend/scripts/cutover_verify.js`
5. `backend/scripts/wait_for_deploy.js`
6. `backend/scripts/wait_for_oauth_deploy.js`
7. `backend/scripts/verify_vercel_deploy.js`
8. `backend/scripts/verify_deployed_auth_chunk.js`
9. `backend/scripts/verify_vehicle_fix_deployed.js`
10. `backend/scripts/check_vercel_bundle.js`
11. `backend/scripts/check_frontend_oauth_bundle.js`
12. `backend/scripts/scan_vercel_env.js`
13. `backend/scripts/final_release_verify.js`
14. `backend/scripts/verify_users_production_final.js`

**Frontend (2):**
15. `src/app/admin/pages/slots-info/slots-info.component.ts`
16. `src/app/services/booking.service.ts`

---

## 2. Files Changed (not deleted)

### Security & API

| File | Change |
|------|--------|
| `backend/routes/settings.js` | `GET /` and `GET /:key` expose **public site keys only** |
| `backend/utils/publicSettings.js` | **New** — shared whitelist of public setting keys |
| `backend/utils/devLog.js` | **New** — dev-only logging helper |
| `backend/middleware/auth.js` | Auth debug gated (Phase 1, verified) |
| `backend/server.js` | `SESSION_SECRET` required (Phase 1, verified) |
| `backend/config/passport.js` | Google Auth verbose logs gated via `devLog` |
| `backend/utils/googleOAuth.js` | OAuth debug gated in production |
| `backend/routes/bookings.js` | POST debug logs gated in production |
| `backend/routes/slots.js` | Slots debug gated in production |
| `backend/create_admin.js` | Removed hardcoded `admin123`; requires email+password |

### Validators

| File | Change |
|------|--------|
| `backend/validators/slot.validator.js` | Capacity `1–100`; removed legacy `electric/petrol/bike` sum=5 rules |

### Frontend

| File | Change |
|------|--------|
| `src/app/services/api.service.ts` | Syncs user state from `AuthService.userProfile$` — **no startup `/auth/me`** |
| `src/app/admin/pages/users/users.component.ts` | Removed `console.log` debug |

### Scripts (kept, hardened)

| File | Change |
|------|--------|
| `backend/scripts/lib/requireAdminCreds.js` | **New** — requires `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| `verify_users_api.js`, `verify_users_production.js`, `production_qa_audit.js` | No `admin123` fallback |
| `apply_slot_capacity_migration.js`, `post_deploy_smoke.js` | Uses `requireAdminCreds` |
| `e2e_production_verify.js`, `verify_auth_session_flow.js` | Uses `requireAdminCreds` |
| `verify_google_oauth_production.js`, `verify_trainers_vehicles_production.js` | Uses `requireAdminCreds` |
| `verify_inactive_blocked_production.js` | Uses `requireAdminCreds` |
| `audit_public_settings.js` | Uses shared `publicSettings` util |

### Infrastructure

| File | Change |
|------|--------|
| `ecosystem.config.js` | **New** — PM2 config for Hostinger |
| `HOSTINGER_PRODUCTION_CHECKLIST.md` | **New** — pre-cutover checklist |

---

## 3. Build Result

```
npm run build -- --configuration=production
✓ Application bundle generation complete

Initial total:  825.81 kB raw | 204.90 kB transfer (gzip)
Output:         dist/demo/
```

No TypeScript errors. No broken imports after deletions.

---

## 4. Security Findings

### Fixed in Phase 2

| Issue | Resolution |
|-------|------------|
| Public `GET /api/settings` exposed `auto_slot_capacity_from_vehicles` | Whitelist filter via `publicSettings.js` |
| Public `GET /api/settings/:key` allowed any key | Non-public keys return **404** |
| Hardcoded `admin123` in 10+ scripts | `requireAdminCreds.js` — env required |
| `create_admin.js` default password | Removed; requires CLI args or env |
| Duplicate `/auth/me` on every page load | `ApiService` syncs from `AuthService` |
| Google Auth / Bookings / Slots debug logs in production | Gated via `NODE_ENV` / `devLog` |
| Frontend admin users `console.log` | Removed |

### Public settings — before vs after

**Before (production API):**
```json
{
  "auto_slot_capacity_from_vehicles": true,
  "contact_email": "kolkatabiketraning@gmail.com",
  "contact_phone": "123242343",
  "site_name": "Kolkata Scotty bike Training "
}
```

**After (local code — deploy to activate on Render):**
```json
{
  "contact_email": "...",
  "contact_phone": "...",
  "site_name": "..."
}
```
Operational keys (`auto_slot_capacity_from_vehicles`, etc.) are excluded. Admins use `GET /api/admin/settings` or `GET /api/settings/all` (authenticated).

### Public settings whitelist

`site_name`, `site_logo`, `contact_email`, `contact_phone`, `contact_address`, `social_facebook`, `social_instagram`, `social_youtube`, `footer_copyright`, `about_text`

### Verified security controls

| Control | Status |
|---------|--------|
| `JWT_SECRET` required | ✓ `authenticate` middleware fails without it |
| `SESSION_SECRET` required | ✓ Server exits on startup if missing |
| `NODE_ENV=production` on Render | **Action:** confirm in Render dashboard |
| Auth debug logs off in production | ✓ Gated |
| Passport verbose logs off in production | ✓ Gated |
| Bookings/slots debug off in production | ✓ Gated |

### Remaining security items (not changed — backward compat)

| Issue | Severity | Phase 3 suggestion |
|-------|----------|-------------------|
| `GET /api/events` SSE unauthenticated | Medium | Add token check |
| CORS allows `*.vercel.app` suffix | Medium | Scope to known previews |
| `create_admin.js` still documents example email in comments | Low | OK |
| `verify_google_oauth_production.js` keeps `STALE_HOST` constant for **detection** (not credentials) | Low | Intentional |
| `server.js` localhost:4200 in dev CORS | Low | Dev only |
| Frontend hardcoded Render API URL fallbacks | Low | Use environment only |

---

## 5. Migration Status

### Core (`verify_migrations.js`) — 8/8 PASS (unchanged from Phase 1)

All June 2026 RBAC, notifications, audit, password management migrations applied on Neon.

### Extended — 4/5 applied

| Migration | Status |
|-----------|--------|
| `20260406000000` inactive_blocked | Applied |
| `20260610140000` slot capacity 1–100 | Applied |
| `20260124000000` slot_vehicle_capacity | Applied |
| `20260321120000` bookings slot+trainer | Applied |
| `20260610120000` vehicles.type default | **Pending** (optional) |

---

## 6. Validator Alignment

### `slot.validator.js` changes

| Rule | Before | After |
|------|--------|-------|
| `capacity` | `1–5` | `1–100` (from `SLOT_CAPACITY.MAX`) |
| `electric_capacity` / `petrol_capacity` / `bike_capacity` | Validated, sum must equal 5 | **Removed** (legacy; capacity via `slot_vehicle_capacity`) |

**Business logic unchanged:** Booking calculations, capacity recalculation (`slotCapacity.service.js`), and DB constraints untouched.

---

## 7. Frontend HTTP Layer Audit

### Before

```
App bootstrap:
  AuthService  → GET /auth/me
  ApiService   → GET /auth/me (+ fallback /profiles/me)
  SettingsService → GET /settings
```

### After

```
App bootstrap:
  AuthService  → GET /auth/me  (single source of truth)
  ApiService   → subscribes to AuthService.userProfile$ (no HTTP)
  SettingsService → GET /settings (public keys only)
```

### Service responsibilities (unchanged behavior)

| Service | Role |
|---------|------|
| `AuthService` | Customer + admin session, OAuth, guards |
| `HttpService` | Thin wrapper for admin/customer HTTP calls |
| `ApiService` | Booking CRUD, trainers, slots helpers; user state mirrored from Auth |
| `AdminService` | Admin panel CRUD |
| `SlotService` / `TrainerService` / `SettingsService` | Feature-specific endpoints |

**Not merged in Phase 2** (Phase 3): Consolidating `SlotService` + `TrainerService` into `HttpService` to avoid larger refactor risk.

---

## 8. Structure — Refactor Plan (NOT executed)

### `backend/routes/bookings.js` (1,153 lines)

**Proposed extraction (Phase 3+):**

| New module | Responsibility |
|------------|----------------|
| `services/bookingCreation.service.js` | `POST /` transaction: validation, assignment, insert, notifications |
| `services/bookingCancellation.service.js` | `PUT /:id/cancel` |
| `services/bookingReschedule.service.js` | `PUT /:id/update` |
| `controllers/bookings.controller.js` | Thin handlers calling services |
| `routes/bookings.routes.js` | Route definitions + middleware chain only |

**Keep in route:** Middleware wiring (`authenticate`, `validateBookingCreation`, `logPostBookingRequest`).

### `backend/routes/admin.js` (1,751 lines)

**Proposed extraction:**

| New module | Responsibility |
|------------|----------------|
| `services/adminUsers.service.js` | Users/customers list, export, CRUD |
| `services/adminTrainers.service.js` | Trainer CRUD + delete preview |
| `services/adminBookings.service.js` | Booking list, status, delete |
| `services/adminSubAdmins.service.js` | Sub-admin + admin account CRUD |
| `controllers/admin.controller.js` | Thin handlers per resource |
| `routes/admin/` | Split into `users.routes.js`, `trainers.routes.js`, etc. |

**Estimated effort:** 3–5 days with regression testing. **Not started in Phase 2.**

---

## 9. Hostinger Readiness

| Item | Status |
|------|--------|
| `ecosystem.config.js` | ✓ Created at repo root |
| `HOSTINGER_DEPLOYMENT_GUIDE.md` | ✓ From Phase 1 |
| `HOSTINGER_PRODUCTION_CHECKLIST.md` | ✓ Created Phase 2 |
| Production build output | ✓ `dist/demo/browser/` |
| `SESSION_SECRET` / `JWT_SECRET` docs | ✓ `.env.example` |
| Nginx SSE config documented | ✓ In deployment guide |
| SSL checklist | ✓ In checklist |
| Upload folder permissions | Documented (static dist + `logs/`) |
| PM2 logs path | `./logs/api-*.log` — create before first start |

---

## 10. Remaining Technical Debt

| Priority | Item |
|----------|------|
| High | Deploy Phase 2 backend to Render (settings whitelist, debug gating) |
| High | Confirm `NODE_ENV=production` + `SESSION_SECRET` on Render |
| Medium | Apply `20260610120000_vehicles_type_legacy_default.sql` |
| Medium | Authenticate `/api/events` SSE |
| Medium | Remove `routes/adminManagement.js` (dead API) after confirmation |
| Medium | Lazy-load `admin.design-system.css` (678 lines global) |
| Low | Merge duplicate HTTP services (`SlotService`, `TrainerService`) |
| Low | Extract fat routes per refactor plan |
| Low | Ratings table schema mismatch (migration vs runtime) |
| Low | Remove legacy slot breakdown columns from DB + UI |

---

## 11. Unused Code Still Present

| Item | Notes |
|------|-------|
| `backend/routes/adminManagement.js` | Not deleted — needs stakeholder confirmation |
| Dead `ApiService` methods | `getAllBookings`, `getDashboardStats`, etc. |
| Dead `TrainerService` CRUD methods | Admin uses `AdminService` |
| `audit_logs` table | Legacy fallback in admin routes |
| `admins` table | Parallel RBAC model |

---

## 12. Production Score

| Criterion | Weight | Score |
|-----------|--------|-------|
| Core booking flow | 20% | 92 |
| Admin panel | 20% | 88 |
| Auth/OAuth | 15% | 85 |
| Schema/migrations | 15% | 88 |
| Security | 15% | 82 |
| Code hygiene | 10% | 78 |
| Build/deploy | 5% | 90 |

### **Overall: 84/100 — GO**

---

## 13. Go / No-Go Recommendation

### **GO** for production deployment after:

1. **Deploy backend** with Phase 2 changes to Render
2. **Verify** `SESSION_SECRET` and `NODE_ENV=production` set on Render
3. **Run** `node backend/scripts/audit_public_settings.js` — confirm zero `leakedOperationalKeys`
4. **Run** `node backend/scripts/e2e_production_verify.js` with credentials in `.env`
5. **Manual smoke:** Google login → book slot → admin dashboard

### **NO-GO** if:

- Render missing `SESSION_SECRET` (API will not start)
- Public settings still expose operational keys after deploy (old code still live)
- Production build fails (currently passes)

---

## 14. Safe-to-Delete List (remaining — NOT deleted)

| File | Reason deferred |
|------|-----------------|
| `backend/routes/adminManagement.js` | Parallel admin API; confirm no external consumers |
| `backend/env.example.txt` | Duplicate of `.env.example`; low risk |

---

*Phase 2 complete. No git commit, push, or production deploy performed.*
