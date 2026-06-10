# Hostinger Production Checklist

**Project:** Kolkata Scooty Bike Training  
**Use before DNS cutover from Render/Vercel to Hostinger VPS**

---

## Pre-Migration (on current stack)

- [ ] `npm run build -- --configuration=production` passes locally
- [ ] `node backend/scripts/verify_migrations.js` — 8/8 PASS
- [ ] `node backend/scripts/audit_migrations_extended.js` — review pending items
- [ ] `node backend/scripts/e2e_production_verify.js` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`
- [ ] Neon DB backup exported (`pg_dump -Fc`)
- [ ] Secrets rotated if ever shared in chat (JWT, SESSION, OAuth, SMTP, DB)

---

## VPS Provisioning

- [ ] Ubuntu 22.04 LTS, 2+ vCPU, 4GB+ RAM
- [ ] Node.js 20.x LTS installed
- [ ] PostgreSQL 15+ (local or managed)
- [ ] PM2 installed globally (`npm i -g pm2`)
- [ ] Nginx installed
- [ ] UFW: allow 22, 80, 443 only — **not** 5432 publicly
- [ ] `mkdir -p logs` at repo root (for `ecosystem.config.js`)

---

## Environment Variables (`backend/.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | **Yes** | Must be `production` |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | 64-char random hex |
| `SESSION_SECRET` | **Yes** | Server exits if missing |
| `GOOGLE_CLIENT_ID` | **Yes** | Customer OAuth |
| `GOOGLE_CLIENT_SECRET` | **Yes** | Customer OAuth |
| `GOOGLE_CALLBACK_URL` | **Yes** | `https://yourdomain.com/api/auth/google/callback` |
| `FRONTEND_URL` | **Yes** | `https://yourdomain.com` |
| `PORT` | Yes | `3000` (behind Nginx) |
| `HOST` | Yes | `127.0.0.1` |
| SMTP vars | Optional | Inactivity alerts |
| `DISABLE_AUTO_SLOT_CRON` | Optional | `0` = enabled |
| `DISABLE_INACTIVITY_CRON` | Optional | `0` = enabled |

- [ ] No secrets committed to git
- [ ] `.env` file permissions `600`
- [ ] `backend/.env.example` used as template only

---

## Database

- [ ] Run all migrations via `scripts/database/apply_all_migrations.ps1` order (32 files)
- [ ] Or restore Neon dump then apply delta migrations
- [ ] `node backend/scripts/verify_migrations.js` on new DB
- [ ] Optional: `node backend/apply_migration.js supabase/migrations/20260610120000_vehicles_type_legacy_default.sql --skip-admin`
- [ ] Create superadmin: `ADMIN_EMAIL=... ADMIN_PASSWORD=... node backend/create_admin.js`

---

## Backend Deploy

- [ ] `cd backend && npm ci --omit=dev`
- [ ] `pm2 start ecosystem.config.js` from repo root
- [ ] `pm2 save && pm2 startup`
- [ ] `curl http://127.0.0.1:3000/health` returns `ok`
- [ ] `curl http://127.0.0.1:3000/api/version` returns commit info

---

## Frontend Deploy

- [ ] Update `src/environments/environment.prod.ts` → `apiUrl: 'https://yourdomain.com/api'`
- [ ] `npm ci && npm run build -- --configuration=production`
- [ ] Copy `dist/demo/browser/*` to `/var/www/kolkata-frontend/dist/`
- [ ] Nginx `try_files` → `index.html` for SPA routes
- [ ] `index.html` and `sw.js` — `Cache-Control: no-cache`
- [ ] Hashed JS/CSS — `immutable` long cache

---

## Nginx & SSL

- [ ] Reverse proxy `/api/` → `127.0.0.1:3000`
- [ ] SSE `/api/events` — `proxy_buffering off`, `proxy_read_timeout 86400s`
- [ ] Certbot SSL for domain + www
- [ ] HTTP → HTTPS redirect
- [ ] Google OAuth redirect URI updated to new domain
- [ ] `FRONTEND_URL` and CORS allow new domain

---

## Security Verification

- [ ] `GET /api/settings` returns **only** public site keys (no `auto_slot_capacity_from_vehicles`)
- [ ] `GET /api/settings/auto_slot_capacity_from_vehicles` returns 404
- [ ] Auth debug logs absent when `NODE_ENV=production`
- [ ] `SESSION_SECRET` and `JWT_SECRET` set — no fallbacks
- [ ] Admin scripts use `ADMIN_EMAIL` / `ADMIN_PASSWORD` env (no hardcoded passwords)

---

## Functional Smoke Tests

- [ ] Google OAuth customer login
- [ ] Admin email/password login
- [ ] `GET /api/auth/me` — single call on page load (no duplicate)
- [ ] Booking page shows slots with capacity 6
- [ ] Create / cancel / reschedule booking (manual)
- [ ] Admin: users, trainers, vehicles, slots, bookings
- [ ] Sub-admin permission restrictions (manual)
- [ ] Notifications bell
- [ ] Mobile viewport 375px

---

## Backup & Rollback

- [ ] Daily `pg_dump` cron to `/var/backups/kolkata/`
- [ ] Off-site backup copy (S3 / second server)
- [ ] Keep Render + Neon running 7 days after cutover
- [ ] DNS TTL lowered to 300s before switch
- [ ] Rollback: revert A record to Render/Vercel IP

---

## Post-Cutover

- [ ] `node backend/scripts/post_deploy_smoke.js` against new host
- [ ] Monitor PM2 logs 24h
- [ ] SSL Labs scan (target grade A)
- [ ] Update README with new production URLs

---

*See also: `HOSTINGER_DEPLOYMENT_GUIDE.md`, `PRODUCTION_PHASE2_REPORT.md`*
