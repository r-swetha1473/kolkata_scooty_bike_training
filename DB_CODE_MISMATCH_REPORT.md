# Database Code Mismatch Report

**Generated:** 2026-01-19T16:03:43.327Z

**Total SQL Queries Analyzed:** 206

---

## ✅ All Referenced Tables Exist

## ✅ All Referenced Columns Exist

## ⚠️ Deprecated Columns Still in Use

The following deprecated columns are still referenced in code:

### Table: `slots`

- **Column:** `electric_capacity` (DEPRECATED)
  **Referenced in:**
  - `backend\routes\bookings.js` (line 542)

- **Column:** `petrol_capacity` (DEPRECATED)
  **Referenced in:**
  - `backend\routes\bookings.js` (line 542)

- **Column:** `bike_capacity` (DEPRECATED)
  **Referenced in:**
  - `backend\routes\bookings.js` (line 542)

---

## Summary

- **Missing Tables:** 0
- **Missing Columns:** 0
- **Schema-Code Mismatches:** 2
- **Deprecated Columns in Use:** 3

⚠️ **Action Required:** Please review the mismatches above and update code or schema accordingly.

**Notes:**
- Schema-code mismatches indicate code uses different column names than the database schema
- Deprecated columns should be removed from code and replaced with new implementations
- Missing columns may need to be added to the schema or removed from code
