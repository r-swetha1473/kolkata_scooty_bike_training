/**
 * Offline booking schema prerequisites — read-only checks for migrations / startup.
 */

const db = require('../db');

const REQUIRED_COLUMNS = [
  'booking_source',
  'created_by_admin_id',
  'offline_customer_name',
  'offline_customer_age',
  'offline_customer_gender',
  'offline_reference_number',
  'attendance_status'
];

const REQUIRED_ENUMS = ['booking_source_enum', 'attendance_status_enum'];

const REQUIRED_TABLES = ['booking_events', 'account_reactivation_requests'];

const REQUIRED_FUNCTIONS = [
  'generate_offline_reference_number',
  'prune_inactive_slot_vehicle_capacities',
  'set_booking_vehicle_type_from_vehicle'
];

const REQUIRED_SEQUENCE = 'offline_booking_reference_seq';

const REQUIRED_INDEXES = [
  'idx_bookings_booking_source',
  'idx_bookings_created_by_admin_id',
  'idx_bookings_offline_reference_number',
  'idx_bookings_attendance_status'
];

const REQUIRED_CONSTRAINT = 'bookings_source_identity_check';

const MIGRATION_HINTS = {
  booking_source: '20260614120000_offline_bookings_and_live_capacity.sql',
  created_by_admin_id: '20260614120000_offline_bookings_and_live_capacity.sql',
  offline_customer_name: '20260614120000_offline_bookings_and_live_capacity.sql',
  offline_customer_age: '20260614120000_offline_bookings_and_live_capacity.sql',
  offline_customer_gender: '20260614120000_offline_bookings_and_live_capacity.sql',
  booking_source_enum: '20260614120000_offline_bookings_and_live_capacity.sql',
  bookings_source_identity_check: '20260614120000_offline_bookings_and_live_capacity.sql',
  set_booking_vehicle_type_from_vehicle: '20260614120000_offline_bookings_and_live_capacity.sql',
  prune_inactive_slot_vehicle_capacities: '20260614120000_offline_bookings_and_live_capacity.sql',
  offline_reference_number: '20260615120000_phase2_offline_enhancements.sql',
  attendance_status: '20260615120000_phase2_offline_enhancements.sql',
  attendance_status_enum: '20260615120000_phase2_offline_enhancements.sql',
  booking_events: '20260615120000_phase2_offline_enhancements.sql',
  generate_offline_reference_number: '20260615120000_phase2_offline_enhancements.sql',
  offline_booking_reference_seq: '20260615120000_phase2_offline_enhancements.sql',
  idx_bookings_offline_reference_number: '20260615120000_phase2_offline_enhancements.sql',
  idx_bookings_attendance_status: '20260615120000_phase2_offline_enhancements.sql',
  account_reactivation_requests: '20260612120000_account_reactivation_requests.sql'
};

function migrationHint(key) {
  return MIGRATION_HINTS[key] || '20260407120000_production_schema_safety_net.sql';
}

function parseDatabaseTarget() {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    return {
      mode: 'individual_params',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'biketraining'
    };
  }
  try {
    const parsed = new URL(url);
    return {
      mode: 'database_url',
      host: parsed.hostname,
      database: (parsed.pathname || '').replace(/^\//, '') || '(unknown)',
      ssl: parsed.searchParams.get('sslmode') || '(default)'
    };
  } catch {
    return { mode: 'database_url', host: '(unparseable)', database: '(unparseable)' };
  }
}

async function auditOfflineBookingSchema() {
  const missing = {
    columns: [],
    enums: [],
    tables: [],
    functions: [],
    sequences: [],
    indexes: [],
    constraints: [],
    prerequisites: []
  };

  const colRes = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bookings'
       AND column_name = ANY($1::text[])`,
    [REQUIRED_COLUMNS]
  );
  const presentCols = new Set(colRes.rows.map((r) => r.column_name));
  for (const col of REQUIRED_COLUMNS) {
    if (!presentCols.has(col)) {
      missing.columns.push({ name: col, migration: migrationHint(col) });
    }
  }

  const enumRes = await db.query(
    `SELECT typname FROM pg_type WHERE typname = ANY($1::text[])`,
    [REQUIRED_ENUMS]
  );
  const presentEnums = new Set(enumRes.rows.map((r) => r.typname));
  for (const en of REQUIRED_ENUMS) {
    if (!presentEnums.has(en)) {
      missing.enums.push({ name: en, migration: migrationHint(en) });
    }
  }

  for (const table of REQUIRED_TABLES) {
    const r = await db.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    if (!r.rows[0]?.reg) {
      missing.tables.push({ name: table, migration: migrationHint(table) });
    }
  }

  const fnRes = await db.query(
    `SELECT proname FROM pg_proc WHERE proname = ANY($1::text[])`,
    [REQUIRED_FUNCTIONS]
  );
  const presentFns = new Set(fnRes.rows.map((r) => r.proname));
  for (const fn of REQUIRED_FUNCTIONS) {
    if (!presentFns.has(fn)) {
      missing.functions.push({ name: fn, migration: migrationHint(fn) });
    }
  }

  const seqRes = await db.query(`SELECT to_regclass($1) AS reg`, [`public.${REQUIRED_SEQUENCE}`]);
  if (!seqRes.rows[0]?.reg) {
    missing.sequences.push({
      name: REQUIRED_SEQUENCE,
      migration: migrationHint(REQUIRED_SEQUENCE)
    });
  }

  const idxRes = await db.query(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'bookings'
       AND indexname = ANY($1::text[])`,
    [REQUIRED_INDEXES]
  );
  const presentIdx = new Set(idxRes.rows.map((r) => r.indexname));
  for (const idx of REQUIRED_INDEXES) {
    if (!presentIdx.has(idx)) {
      missing.indexes.push({ name: idx, migration: migrationHint(idx) });
    }
  }

  const conRes = await db.query(
    `SELECT 1 FROM pg_constraint
     WHERE conrelid = 'bookings'::regclass AND conname = $1`,
    [REQUIRED_CONSTRAINT]
  );
  if (conRes.rows.length === 0) {
    missing.constraints.push({
      name: REQUIRED_CONSTRAINT,
      migration: migrationHint(REQUIRED_CONSTRAINT)
    });
  }

  try {
    await db.query(
      `SELECT booking_source, created_by_admin_id, offline_customer_name,
              offline_customer_age, offline_customer_gender, offline_reference_number,
              attendance_status
       FROM bookings LIMIT 0`
    );
  } catch (error) {
    missing.prerequisites.push({
      check: 'SELECT offline booking columns',
      error: error.message,
      code: error.code
    });
  }

  try {
    await db.query('SELECT generate_offline_reference_number() AS ref');
  } catch (error) {
    missing.prerequisites.push({
      check: 'generate_offline_reference_number()',
      error: error.message,
      code: error.code,
      migration: migrationHint('generate_offline_reference_number')
    });
  }

  try {
    await db.query('SELECT 1 FROM booking_events LIMIT 0');
  } catch (error) {
    if (error.code === '42P01') {
      missing.tables.push({
        name: 'booking_events',
        migration: migrationHint('booking_events')
      });
    } else {
      missing.prerequisites.push({
        check: 'booking_events readable',
        error: error.message,
        code: error.code
      });
    }
  }

  const nullableRes = await db.query(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bookings'
       AND column_name = 'user_id'`
  );
  const userIdNullable = nullableRes.rows[0]?.is_nullable === 'YES';
  if (!userIdNullable) {
    missing.prerequisites.push({
      check: 'bookings.user_id nullable for walk-ins',
      error: 'user_id is still NOT NULL',
      migration: migrationHint('offline_customer_name')
    });
  }

  const totalMissing =
    missing.columns.length +
    missing.enums.length +
    missing.tables.length +
    missing.functions.length +
    missing.sequences.length +
    missing.indexes.length +
    missing.constraints.length +
    missing.prerequisites.length;

  return {
    ok: totalMissing === 0,
    target: parseDatabaseTarget(),
    missing,
    requiredMigrations: [...new Set(
      [
        ...missing.columns,
        ...missing.enums,
        ...missing.tables,
        ...missing.functions,
        ...missing.sequences,
        ...missing.indexes,
        ...missing.constraints,
        ...missing.prerequisites
      ]
        .map((item) => item.migration)
        .filter(Boolean)
    )].sort()
  };
}

async function ensureOfflineBookingSchemaOnStartup() {
  const report = await auditOfflineBookingSchema();
  if (report.ok) {
    console.log('[Offline booking schema] All prerequisites present', {
      host: report.target.host,
      database: report.target.database
    });
    return report;
  }

  console.error('[Offline booking schema] MISSING OBJECTS — offline bookings will fail with SCHEMA_MISMATCH');
  console.error('[Offline booking schema] Database target:', report.target);
  if (report.missing.columns.length) {
    console.error('[Offline booking schema] Missing columns:', report.missing.columns);
  }
  if (report.missing.enums.length) {
    console.error('[Offline booking schema] Missing enums:', report.missing.enums);
  }
  if (report.missing.tables.length) {
    console.error('[Offline booking schema] Missing tables:', report.missing.tables);
  }
  if (report.missing.functions.length) {
    console.error('[Offline booking schema] Missing functions:', report.missing.functions);
  }
  if (report.missing.sequences.length) {
    console.error('[Offline booking schema] Missing sequences:', report.missing.sequences);
  }
  if (report.missing.indexes.length) {
    console.error('[Offline booking schema] Missing indexes:', report.missing.indexes);
  }
  if (report.missing.constraints.length) {
    console.error('[Offline booking schema] Missing constraints:', report.missing.constraints);
  }
  if (report.missing.prerequisites.length) {
    console.error('[Offline booking schema] Failed prerequisite checks:', report.missing.prerequisites);
  }
  console.error('[Offline booking schema] Apply migrations in order:', [
    '20260614120000_offline_bookings_and_live_capacity.sql',
    '20260615120000_phase2_offline_enhancements.sql',
    '20260407120000_production_schema_safety_net.sql'
  ]);
  return report;
}

function formatSchemaPgError(err) {
  return {
    pgCode: err.code || null,
    pgMessage: err.message || String(err),
    pgDetail: err.detail || null,
    pgHint: err.hint || null,
    pgTable: err.table || null,
    pgColumn: err.column || null,
    pgRoutine: err.routine || null
  };
}

const SCHEMA_PG_CODES = new Set(['42703', '42704', '42883', '42P01']);

function isOfflineBookingSchemaError(err) {
  if (!err || !SCHEMA_PG_CODES.has(err.code)) return false;
  const msg = String(err.message || '').toLowerCase();
  const offlineMarkers = [
    'booking_source',
    'offline_',
    'attendance_status',
    'booking_events',
    'generate_offline_reference',
    'offline_booking_reference_seq',
    'booking_source_enum',
    'attendance_status_enum'
  ];
  return offlineMarkers.some((m) => msg.includes(m));
}

module.exports = {
  REQUIRED_COLUMNS,
  REQUIRED_ENUMS,
  REQUIRED_TABLES,
  REQUIRED_FUNCTIONS,
  auditOfflineBookingSchema,
  ensureOfflineBookingSchemaOnStartup,
  formatSchemaPgError,
  isOfflineBookingSchemaError,
  parseDatabaseTarget,
  SCHEMA_PG_CODES
};
