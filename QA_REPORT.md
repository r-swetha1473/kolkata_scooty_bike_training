# QA Report — Slot Booking System

**Date:** 2026-03-21  
**Environment verified:** Local `npx ng build --configuration=development` (pass). Backend JS `node --check` on modified routes/services (pass). **Full API integration tests** were not run (no DB / `npm test` script in backend).

---

## 1. Test matrix (manual / recommended)

| # | Scenario | Expected | Notes |
|---|----------|----------|-------|
| 1 | `GET /health` | 200 JSON | Not yet wrapped in `{ success, data }` — acceptable for probes |
| 2 | `GET /api/slots/date/:date` | 200, rows include `vehicle_capacities` | Requires `slot_vehicle_capacity` migration |
| 3 | `POST /api/slots/generate` with `date` = today | **400** `GENERATE_FUTURE_DATE_REQUIRED`, `data.suggestedDate` | Server enforces future-only |
| 4 | `POST /api/slots/generate` with `date` = tomorrow | 200 or 409 if duplicate unassigned rows | Uses existing “next date” conflict path |
| 5 | `GET /api/slots/available` | Only slots with `start_time` in `(now, now+24h]` | Aligned with booking window |
| 6 | `POST /api/bookings` slot 30h away | **400** booking window | `BOOKING_NOT_OPEN_YET` / validation message |
| 7 | `POST /api/bookings` slot 2h away (in window, trainer, capacity OK) | 200 booking row | Inside 24h window |
| 8 | Weekly limit | Third active booking same ISO week | **400** `WEEKLY_LIMIT_REACHED` |
| 9 | `PUT /api/bookings/:id/cancel` inside 5h | **400** cancellation window | |
| 10 | `PUT /api/bookings/:id/cancel` as customer | 200; row in `admin_audit_log` `USER_CANCEL_BOOKING` | |
| 11 | `PUT /api/slots/:id/vehicle-capacity` | Body `{ "vehicle_capacities": { "<uuid>": 3 } }` | UUID keys string-compared in route |

---

## 2. Regression risks & mitigations

| Risk | Mitigation |
|------|------------|
| **Booking window semantics changed** from “≥24h before slot” to “inside last 24h before slot” | Intentional alignment with requirement “Booking opens 24 hours before slot”; update any external docs/trainers |
| **`slot_vehicle_capacity` missing** | Booking INSERT uses subquery; fails until migration applied |
| **Drop `slots_capacity_check`** | Run new migration only after confirming no dependency on `capacity = 5`; totals should still match business sum |
| **IST vs UTC “today”** | Generation uses `getToday()` UTC; admin UI bumps to tomorrow when date ≤ today |

---

## 3. Build / static verification

- **Angular:** `npx ng build --configuration=development` — **OK** (2026-03-21).
- **Backend syntax:** `node --check` on `routes/bookings.js`, `routes/slots.js`, `services/bookingValidation.service.js` — **OK**.

---

## 4. Outstanding / out of scope

- Full **supertest** run (`backend/test/endpoints.test.js`) against a real database.
- Standardizing **every** success response to `{ success, message, data }` (error handler already standardizes errors; many GETs still return raw arrays).
- **PostgreSQL triggers** from `20260120000000_phase2_vehicle_based_bookings.sql` may still reference old slot columns for `vehicle_type` capacity — verify on your DB if inserts fail.
- **Pagination** polish on admin bookings/users pages (only slots search width addressed in this pass).

---

## 5. Sign-off checklist for production

- [ ] Apply `20260321000000_drop_slots_capacity_eq5_constraint.sql` (if DBA approves)  
- [ ] Confirm `slot_vehicle_capacity` + `ensure_slot_vehicle_capacities` exist  
- [ ] Smoke-test booking + cancel + admin generate on staging  
- [ ] Confirm server `timezone` / `CURRENT_DATE` behaviour matches Kolkata expectations or document UTC baseline  

---

*End of QA report.*
