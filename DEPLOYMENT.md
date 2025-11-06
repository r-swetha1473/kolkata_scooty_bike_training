Deployment Guide (Angular + Node/Express + PostgreSQL)

Prerequisites
- Node.js 18+ and npm
- Angular CLI 17+ (for local builds): npm install -g @angular/cli
- PostgreSQL 14+ with a database created
- A Linux server (Ubuntu 22.04+ recommended) with a process manager (PM2) and a reverse proxy (Nginx) or use Docker

Environment Variables
- Copy backend/env.example.txt to backend/.env and fill values. See backend/ENV_SETUP.md for full details.
- Critical vars:
  - Database: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL(optional)
  - Server: PORT, FRONTEND_URL, CORS_ORIGIN
  - Auth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, SESSION_SECRET
  - SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

Database Migration
Option A: Using provided PostgreSQL scripts (no Supabase)
1) Ensure backend/.env has correct DB_ values and the DB exists
2) From project root, run one of:
   - Windows PowerShell:
     ./apply_postgresql_migration.ps1
   - Linux/macOS:
     bash ./apply_postgresql_migration.sh
3) The script will:
   - Connect to the database
   - Apply SQL in supabase/migrations/*_migrate_to_direct_postgresql.sql and other required statements
   - Automatically create a default admin user with credentials:
     * Email: admin@kolkatascotty.com
     * Password: admin123
     * Role: superadmin
4) After migration, you can log in to the admin panel immediately
5) ⚠️ IMPORTANT: Change the default password after first login!
6) To create additional admin users manually:
   cd backend && node create_admin.js [email] [password] [role]

Option B: Supabase-compatible SQL (manual)
- Apply SQL under supabase/migrations/ directly using psql or a GUI (DBeaver/pgAdmin).

Backend Deployment (Node/Express)
1) Install dependencies
   cd backend
   npm ci

2) Build (if applicable) and start with PM2
   pm2 start server.js --name biketraining-api
   pm2 save
   pm2 startup   # follows instructions to persist across reboots

3) Health check
   curl -I http://localhost:3000/health   # if you have a health route

Nginx Reverse Proxy (recommended)
1) Create site config (example):
   /etc/nginx/sites-available/biketraining
   server {
     server_name example.com;
     listen 80;
     location /api/ {
       proxy_pass http://127.0.0.1:3000/;  # Express API
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
     }
     location / {
       root /var/www/biketraining;        # Angular dist
       try_files $uri /index.html;
     }
   }

2) Enable and reload
   ln -s /etc/nginx/sites-available/biketraining /etc/nginx/sites-enabled/biketraining
   nginx -t && systemctl reload nginx

3) SSL with Let’s Encrypt (Certbot)
   apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d example.com

Frontend Deployment (Angular)
1) Set environment.apiUrl to your API base (e.g., https://example.com/api)
   - File: src/environments/environment.prod.ts

2) Build
   cd frontend root (project root if Angular at src/)
   npm ci
   ng build --configuration production
   # Output will be in dist/ (e.g., dist/biketraining)

3) Copy build to server
   rsync -avz dist/biketraining/ user@server:/var/www/biketraining/

4) Verify in browser
   Open https://example.com

Google OAuth Redirects
- Set Google Console OAuth redirect URI to: https://example.com/api/auth/google/callback
- FRONTEND_URL must point to your production site so the backend callback redirects properly to /booking with token

Email (SMTP)
- Ensure SMTP_* variables are valid. Booking confirmation emails are sent after successful bookings.

Troubleshooting
- 4xx/5xx from API: check PM2 logs
  pm2 logs biketraining-api --lines 200
- CORS issues: verify CORS_ORIGIN and FRONTEND_URL
- OAuth redirect loops: verify GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and FRONTEND_URL
- DB errors: ensure migrations applied and DB user has privileges

Zero-Downtime Updates
1) Pull latest code and install deps
   git pull
   (cd backend && npm ci)
   (rebuild Angular and deploy dist)
2) Restart API
   pm2 restart biketraining-api

Optional: Docker (outline)
- Create Dockerfiles for frontend and backend
- Use docker-compose with services: api, web (nginx), postgres
- Map env via .env and secrets

Housekeeping
- We removed legacy audit logs UI/backend and old schema files:
  - src/app/admin/pages/audit/audit.component.ts (deleted)
  - backend/routes/admin.js: removed /admin/audit
  - src/app/app.routes.ts: removed /admin/audit route
  - src/app/admin/layout/admin-layout.component.ts: removed nav link
  - src/app/admin/pages/dashboard/dashboard.component.ts: removed audit quick action
  - backend/schema.sql.old, backend/schema_new.sql (deleted)
  - backend/events.js (deleted)


