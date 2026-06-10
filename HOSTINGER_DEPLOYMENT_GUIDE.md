# Hostinger Deployment Guide

**Project:** Kolkata Scooty Bike Training  
**Target:** Self-hosted VPS (Hostinger) — Node.js API + PostgreSQL + Angular static frontend  
**Current stack:** Render (API) + Vercel (FE) + Neon (DB)

> Use this guide when migrating from Render/Vercel to Hostinger. Test on a staging VPS before cutting over production DNS.

---

## Architecture Overview

```
                    ┌─────────────────┐
   Users ──────────►│  Nginx (443)    │
                    │  SSL termination│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        / (static)     /api/* proxy    /events SSE
        Angular dist   Node :3000       (long-lived)
                             │
                             ▼
                    ┌─────────────────┐
                    │  PostgreSQL     │
                    │  (local or      │
                    │   managed)      │
                    └─────────────────┘
```

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| VPS | Hostinger VPS KVM 2+ (2 vCPU, 4GB RAM minimum) |
| OS | Ubuntu 22.04 LTS |
| Domain | e.g. `kolkatascotty.com` |
| Node.js | 20.x LTS |
| PostgreSQL | 15+ (local install or Hostinger managed DB) |
| PM2 | Process manager |
| Nginx | Reverse proxy + static files |

---

## 1. Production `.env` Template

Copy to `/var/www/kolkata-api/.env` — **never commit this file**.

```bash
# --- Runtime ---
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

# --- Database ---
DATABASE_URL=postgresql://APP_USER:STRONG_PASSWORD@127.0.0.1:5432/kolkata_training?sslmode=disable
DB_POOL_MAX=20
# DB_SSL=false  # local PostgreSQL

# --- Auth ---
JWT_SECRET=GENERATE_64_CHAR_RANDOM_STRING
SESSION_SECRET=GENERATE_64_CHAR_RANDOM_STRING

# --- Google OAuth ---
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

# --- Frontend (CORS + OAuth redirect) ---
FRONTEND_URL=https://yourdomain.com
# FRONTEND_URL_PREVIEW=https://staging.yourdomain.com

# --- Cookies (cross-origin only if FE and API on different subdomains) ---
# COOKIE_SECURE=true
# COOKIE_SAME_SITE=none

# --- Email (optional) ---
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@yourdomain.com
ADMIN_ALERT_EMAIL=admin@yourdomain.com

# --- Cron jobs ---
# DISABLE_INACTIVITY_CRON=0
# INACTIVITY_CRON=0 2 * * *
# INACTIVITY_BLOCK_DAYS=45
# DISABLE_AUTO_SLOT_CRON=0
# AUTO_SLOT_CRON=0 0 * * *
# AUTO_SLOT_CRON_TZ=Asia/Kolkata

# --- WhatsApp (optional) ---
# WHATSAPP_PROVIDER=aisensy
# WHATSAPP_API_KEY=
# ADMIN_PHONE=+919XXXXXXXXX

# --- Debug (keep OFF in production) ---
# LOG_DEBUG=0
# LOG_BOOKING_DEBUG=0
```

### Secret generation

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # SESSION_SECRET
```

### Google OAuth update

In Google Cloud Console → Credentials → OAuth 2.0:

- **Authorized JavaScript origins:** `https://yourdomain.com`
- **Authorized redirect URIs:** `https://yourdomain.com/api/auth/google/callback`

---

## 2. Database Setup

### 2.1 Create database and user

```sql
CREATE USER kolkata_app WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE kolkata_training OWNER kolkata_app;
GRANT ALL PRIVILEGES ON DATABASE kolkata_training TO kolkata_app;
```

### 2.2 Apply migrations (canonical order)

```bash
cd /var/www/kolkata-api/backend
npm ci --omit=dev

# Apply ALL migrations in order (PowerShell script logic, run manually or adapt):
# See scripts/database/apply_all_migrations.ps1 for the ordered list of 32 files

node apply_migration.js ../supabase/migrations/20251102124908_init_schema.sql --skip-admin
# ... repeat for each file in apply_all_migrations.ps1 order ...

# Or use the PowerShell runner from a Windows admin machine against remote DB:
# .\scripts\database\apply_all_migrations.ps1
```

### 2.3 Verify schema

```bash
node scripts/verify_migrations.js
node scripts/db_go_live_check.js
node scripts/verify_inactive_blocked_production.js
node scripts/verify_slots_production.js
```

### 2.4 Migrate data from Neon (if moving existing production)

```bash
# On source (Neon) — export
pg_dump "$NEON_DATABASE_URL" --no-owner --no-acl -Fc -f kolkata_backup.dump

# On Hostinger — import
pg_restore -d kolkata_training --no-owner --no-acl kolkata_backup.dump

# Then apply any migrations newer than dump:
node apply_migration.js ../supabase/migrations/20260610140000_slot_capacity_sum_limit.sql --skip-admin
```

---

## 3. Backend Build & PM2

### 3.1 Install and start

```bash
cd /var/www/kolkata-api/backend
npm ci --omit=dev
```

### 3.2 PM2 ecosystem file

Create `/var/www/kolkata-api/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'kolkata-api',
    script: 'server.js',
    cwd: '/var/www/kolkata-api/backend',
    instances: 1,          // Start with 1; scale after testing
    exec_mode: 'fork',     // Use 'cluster' only if sessions are externalized
    env: {
      NODE_ENV: 'production'
    },
    max_memory_restart: '512M',
    error_file: '/var/log/kolkata/api-error.log',
    out_file: '/var/log/kolkata/api-out.log',
    merge_logs: true,
    time: true,
    kill_timeout: 10000,
    listen_timeout: 10000,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

> **Note:** Google OAuth uses `express-session`. With `instances > 1` and `cluster` mode, sessions require a shared store (Redis). Start with `instances: 1`.

### 3.3 PM2 commands

```bash
sudo mkdir -p /var/log/kolkata
pm2 start /var/www/kolkata-api/ecosystem.config.js
pm2 save
pm2 startup   # follow printed instructions for systemd
```

---

## 4. Frontend Build

### 4.1 Build Angular for production

```bash
cd /var/www/kolkata-frontend
npm ci
npm run build -- --configuration=production
```

Output: `dist/kolkata-scooty-bike-training/browser/`

### 4.2 Environment for Hostinger

Update `src/environments/environment.prod.ts` before build:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://yourdomain.com/api'
};
```

> **Pre-build fix required:** `booking.component.ts` uses undefined `getToday()` — replace with `getKolkataToday()` or build will fail.

### 4.3 Deploy static files

```bash
sudo mkdir -p /var/www/kolkata-frontend/dist
sudo cp -r dist/kolkata-scooty-bike-training/browser/* /var/www/kolkata-frontend/dist/
```

---

## 5. Nginx Configuration

Create `/etc/nginx/sites-available/kolkata`:

```nginx
upstream kolkata_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL — see Section 6
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    root /var/www/kolkata-frontend/dist;
    index index.html;

    # Security headers (supplement Helmet)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Angular SPA — all non-API routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://kolkata_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # Health check (direct to Node)
    location /health {
        proxy_pass http://kolkata_api;
        proxy_set_header Host $host;
    }

    # SSE — disable buffering for real-time slot updates
    location /api/events {
        proxy_pass http://kolkata_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400s;
    }

    # Static asset caching (hashed chunks)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Never cache index.html or service worker
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    client_max_body_size 10M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/kolkata /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. SSL Checklist

- [ ] DNS A record points VPS IP (`yourdomain.com`, `www`)
- [ ] Install Certbot: `sudo apt install certbot python3-certbot-nginx`
- [ ] Issue cert: `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com`
- [ ] Auto-renewal: `sudo certbot renew --dry-run`
- [ ] Verify HTTPS redirect (HTTP → HTTPS)
- [ ] Update Google OAuth redirect URIs to HTTPS
- [ ] Set `COOKIE_SECURE=true` if API served over HTTPS
- [ ] Test OAuth login end-to-end after SSL

---

## 7. Build Scripts

### `scripts/hostinger/deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/var/www/kolkata-api
FE_DIR=/var/www/kolkata-frontend

echo "==> Pull latest code"
cd "$APP_DIR" && git pull origin main

echo "==> Backend dependencies"
cd "$APP_DIR/backend" && npm ci --omit=dev

echo "==> Frontend build"
cd "$FE_DIR" && npm ci && npm run build -- --configuration=production
sudo cp -r dist/kolkata-scooty-bike-training/browser/* /var/www/kolkata-frontend/dist/

echo "==> Restart API"
pm2 reload kolkata-api

echo "==> Smoke test"
curl -sf https://yourdomain.com/health
curl -sf https://yourdomain.com/api/version

echo "Deploy complete."
```

---

## 8. Backup Strategy

### 8.1 Database (daily)

```bash
#!/bin/bash
# /etc/cron.daily/kolkata-db-backup
BACKUP_DIR=/var/backups/kolkata
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
pg_dump -U kolkata_app -d kolkata_training -Fc -f "$BACKUP_DIR/kolkata_$DATE.dump"
find "$BACKUP_DIR" -name "*.dump" -mtime +14 -delete
```

### 8.2 Application files

- Git is source of truth for code
- `.env` backed up separately to encrypted storage (not in git)
- Weekly tarball of `/var/www/kolkata-frontend/dist` (optional)

### 8.3 Off-site

- Copy daily dumps to S3 / Hostinger backup / another region
- Test restore monthly: `pg_restore --list kolkata_YYYYMMDD.dump`

---

## 9. Rollback Strategy

### Code rollback

```bash
cd /var/www/kolkata-api
git log --oneline -5
git checkout <previous-commit-sha>
cd backend && npm ci --omit=dev
pm2 reload kolkata-api
```

### Frontend rollback

```bash
# Keep previous dist snapshot
sudo cp -r /var/www/kolkata-frontend/dist /var/www/kolkata-frontend/dist.backup
# Restore if needed:
sudo rm -rf /var/www/kolkata-frontend/dist
sudo cp -r /var/www/kolkata-frontend/dist.backup /var/www/kolkata-frontend/dist
```

### Database rollback

- **Before any migration:** `pg_dump` full backup
- **To rollback migration:** restore from pre-migration dump (no automatic down migrations)
- **Point-in-time:** Enable PostgreSQL WAL archiving for production

### DNS rollback (cutover)

| Step | Action |
|------|--------|
| Pre-cutover | Lower TTL to 300s (5 min) 24h before |
| Cutover | Point A record to Hostinger IP |
| Rollback | Point A record back to Render/Vercel IP |
| Keep old stack | Leave Render + Neon running 7 days after cutover |

---

## 10. Post-Deploy Verification

```bash
# Health
curl https://yourdomain.com/health
curl https://yourdomain.com/api/version

# Automated suite (from dev machine with .env pointing to new host)
API_BASE=https://yourdomain.com/api node backend/scripts/post_deploy_smoke.js
API_BASE=https://yourdomain.com/api node backend/scripts/e2e_production_verify.js
```

### Manual checklist

- [ ] Google OAuth login (customer)
- [ ] Admin email/password login
- [ ] Create booking (customer)
- [ ] Cancel / reschedule booking
- [ ] Admin: create trainer, vehicle, slot
- [ ] Admin: recalculate slot capacity
- [ ] Sub-admin: verify permission restrictions
- [ ] Notifications bell
- [ ] Mobile responsive check (375px viewport)
- [ ] SSL Labs scan (A rating target)

---

## 11. Differences from Render/Vercel

| Concern | Render/Vercel | Hostinger |
|---------|---------------|-----------|
| `RENDER_EXTERNAL_URL` | Auto-set | Set `GOOGLE_CALLBACK_URL` explicitly |
| HTTPS | Automatic | Certbot + Nginx |
| Cron jobs | Render cron or in-process | system cron or in-process node-cron |
| SSE `/api/events` | Works | Nginx `proxy_buffering off` required |
| Scaling | Auto | Manual PM2 instances + Redis for sessions |
| DB SSL | `rejectUnauthorized: false` | Local DB: SSL optional |
| Static hosting | Vercel CDN | Nginx + optional Cloudflare |

---

## 12. Cron Jobs (system-level alternative)

If in-process crons are disabled:

```cron
# /etc/cron.d/kolkata
0 2 * * * www-data cd /var/www/kolkata-api/backend && node -e "require('./services/inactivity.service').runInactivityCheck()" >> /var/log/kolkata/cron.log 2>&1
0 0 * * * www-data cd /var/www/kolkata-api/backend && node -e "require('./services/slotGeneration.service').ensureDailySlots()" >> /var/log/kolkata/cron.log 2>&1
```

---

## 13. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

PostgreSQL port 5432 should **not** be exposed publicly — bind to `127.0.0.1` only.

---

*Review `PRODUCTION_AUDIT_REPORT.md` for cleanup and security items to complete before Hostinger cutover.*
