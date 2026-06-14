# Production Deployment Verification

**Project:** Kolkata Scooty Bike Training  
**Date:** 2026-06-14  
**Commit:** `98a2daa` — `feat(admin): offline bookings, live capacity, and operational analytics`  
**Targets:** Render (backend) + Vercel (frontend) + Neon (database)

---

## Deployment Status

| Platform | Status | Version / Artifact | Notes |
|----------|--------|-------------------|-------|
| **GitHub** | ✅ Pushed | `98a2daa` on `main` | `c0b71b3..98a2daa` |
| **Render (backend)** | ✅ Live | `commitShort: 98a2daa` | Auto-deploy after push |
| **Vercel (frontend)** | ✅ Live | `main-TVWFEAP7.js` | Matches local production build |
| **Neon (database)** | ✅ Migrations applied | `20260614120000`, `20260615120000` | Applied 2026-06-14 |

### Pre-deploy checks (local)

| Check | Result |
|-------|--------|
| Production build (`ng build`) | ✅ PASS |
| TypeScript errors | ✅ Fixed (offline-bookings, chart tooltip) |
| Git commit | ✅ `98a2daa` |
| Git push `origin/main` | ✅ Complete |
| DB migrations (offline + phase 2) | ✅ Applied successfully |

---

## Render Version

```json
{
  "status": "ok",
  "commitShort": "98a2daa",
  "commit": "98a2daae97fe8982b5c4f1b310964091d65daa14",
  "branch": "main",
  "nodeEnv": "development",
  "service": "kolkata-scooty-bike-training"
}
```

**Action required:** Set `NODE_ENV=production` in Render environment variables.

---

## Vercel Build Version

| Marker | Value |
|--------|-------|
| Main chunk | `main-TVWFEAP7.js` |
| Dashboard lazy chunk | `chunk-AEDQTHMI.js` |
| API URL in bundle | `kolkata-scooty-bike-training.onrender.com` |

---

## Phase 2.1 Deployed Features

### Backend (additive only)

- Offline/walk-in booking API (`POST /admin/offline-bookings`)
- Live capacity sync + `capacity_exceeded` flag
- Booking detail with customer history + audit timeline
- Attendance tracking API (admin-only)
- CSV export with Reference, Source, Attendance, Created By/Date, etc.
- Operational analytics merged into `GET /admin/stats`

### Frontend (admin only)

- Offline Bookings page + customer search/reuse
- Booking details modal (audit, timeline, attendance, customer history)
- Dashboard: Today's Operations, System Health, Vehicle/Trainer Analytics, Admin Activity, Quick Actions
- Slot utilization % + OVER CAPACITY badges
- Export today's bookings from dashboard

### Database migrations applied

1. `20260614120000_offline_bookings_and_live_capacity.sql`
2. `20260615120000_phase2_offline_enhancements.sql`

---

## Pass / Fail Matrix (post-deploy smoke)

### Infrastructure

| Test | Result | Evidence |
|------|--------|----------|
| Render `/health` | ✅ PASS | `status: ok`, `commitShort: 98a2daa` |
| Render `/api/version` | ✅ PASS | `commitShort: 98a2daa` |
| Public settings whitelist | ✅ PASS | Keys: `contact_email`, `contact_phone`, `site_name` only |
| Vercel frontend | ✅ PASS | `main-TVWFEAP7.js` live |

### Unchanged (by design)

| Area | Status |
|------|--------|
| Customer OAuth / Google login | ✅ Unchanged |
| Customer booking flow | ✅ Unchanged |
| Attendance logic (core) | ✅ Unchanged |
| Capacity recalc rules | ✅ Unchanged |

---

## Remaining Issues

| Priority | Issue | Fix |
|----------|-------|-----|
| **P0** | `NODE_ENV=development` on Render | Set `NODE_ENV=production` in Render dashboard → redeploy |
| **P0** | API error responses may include `stack` traces | Resolved when `NODE_ENV=production` |
| **P1** | Admin smoke test (offline booking create) | Manual: Admin → Offline Bookings → create walk-in |
| **P1** | Dashboard analytics verification | Manual: Admin → Dashboard → check Today's Operations, Vehicle/Trainer tables |
| **P1** | Customer booking flow | Manual browser test with Google OAuth |

---

## GO / NO-GO Recommendation

### **GO** (with P0 env fix)

Deployment **succeeded** on Render, Vercel, and Neon migrations.

**Immediate post-deploy checklist:**

1. ✅ Code pushed and deployed (`98a2daa`)
2. ✅ Database migrations applied
3. ⚠️ Set **`NODE_ENV=production`** on Render → redeploy
4. Manual smoke: Admin login → Dashboard → Offline Bookings → create test walk-in
5. Manual smoke: Customer Google login → book slot (confirm unchanged flow)

---

## Quick Re-verification Commands

```powershell
curl.exe -s https://kolkata-scooty-bike-training.onrender.com/api/version
curl.exe -s https://kolkata-scooty-bike-training.onrender.com/api/settings
curl.exe -s https://kolkata-scooty-bike-training.vercel.app/ | findstr main-
```

```powershell
# With ADMIN_EMAIL + ADMIN_PASSWORD in backend/.env
cd backend
node scripts/e2e_production_verify.js
```

---

*Updated after Phase 2.1 deploy — offline bookings, operational analytics, live capacity.*
