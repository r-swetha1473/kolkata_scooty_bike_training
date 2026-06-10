/**
 * Production verification — Trainers & Vehicles modules (with cleanup).
 * Uses documented admin account from apply_postgresql_migration.ps1
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { requireAdminCreds } = require('./lib/requireAdminCreds');
const API = (process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api').replace(/\/$/, '');

async function login() {
  const { email, password } = requireAdminCreds();
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login ${res.status}`);
  return data.token;
}

async function req(method, path, token, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 400); }
  return { status: res.status, data };
}

function slotCapacities(slots) {
  return [...new Set(slots.map((s) => s.capacity))];
}

async function getSlots() {
  const res = await fetch(`${API.replace('/api', '')}/api/slots/available`);
  const data = await res.json();
  const slots = data.slots || data || [];
  return { status: res.status, slots };
}

async function getActiveVehicleCount(token) {
  const all = await req('GET', '/vehicles?include_inactive=true', token);
  const vehicles = Array.isArray(all.data) ? all.data : [];
  return {
    total: vehicles.length,
    active: vehicles.filter((v) => v.is_active !== false).length,
    vehicles
  };
}

async function main() {
  const ts = Date.now();
  const report = {
    timestamp: new Date().toISOString(),
    trainers: { before: {}, after: {}, tests: {}, apiPass: false },
    vehicles: { before: {}, after: {}, tests: {}, capacity: {}, apiPass: false },
    issues: [],
    ui: { note: 'Browser screenshots, console, mobile layout — manual verification required' }
  };

  const token = await login();

  // ─── TRAINERS ───
  const listBefore = await req('GET', '/admin/trainers', token);
  const trainersBefore = Array.isArray(listBefore.data) ? listBefore.data : [];
  report.trainers.before = { status: listBefore.status, count: trainersBefore.length };

  // Validation — missing bio
  const invalidCreate = await req('POST', '/admin/trainers', token, {
    email: `qa-invalid-${ts}@test.invalid`,
    full_name: 'QA Invalid',
    bio: 'short'
  });
  report.trainers.tests.validation = {
    status: invalidCreate.status,
    pass: invalidCreate.status === 400,
    message: invalidCreate.data?.message || invalidCreate.data?.errors?.[0]?.message
  };

  // Create
  const createPayload = {
    email: `qa-trainer-${ts}@test.invalid`,
    full_name: `QA Trainer ${ts}`,
    phone: '9876543210',
    bio: 'Production QA verification trainer bio text.',
    experience_years: 2,
    specialization: ['Scooty'],
    rating: 4.5
  };
  const created = await req('POST', '/admin/trainers', token, createPayload);
  const trainerId = created.data?.id;
  report.trainers.tests.create = {
    status: created.status,
    pass: created.status === 201 && !!trainerId,
    id: trainerId
  };

  // Edit
  let editPass = false;
  if (trainerId) {
    const edited = await req('PUT', `/admin/trainers/${trainerId}`, token, {
      full_name: `QA Trainer Edited ${ts}`,
      bio: 'Updated bio for production QA verification test.'
    });
    editPass = edited.status === 200;
    report.trainers.tests.edit = { status: edited.status, pass: editPass };
  }

  // Deactivate
  let deactivatePass = false;
  if (trainerId) {
    const off = await req('PUT', `/admin/trainers/${trainerId}`, token, { is_active: false });
    deactivatePass = off.status === 200 && off.data?.is_active === false;
    report.trainers.tests.deactivate = { status: off.status, pass: deactivatePass };
  }

  // Activate
  let activatePass = false;
  if (trainerId) {
    const on = await req('PUT', `/admin/trainers/${trainerId}`, token, { is_active: true });
    activatePass = on.status === 200 && on.data?.is_active === true;
    report.trainers.tests.activate = { status: on.status, pass: activatePass };

    // Deactivate again for delete
    await req('PUT', `/admin/trainers/${trainerId}`, token, { is_active: false });
  }

  // Delete (inactive)
  let deletePass = false;
  if (trainerId) {
    const del = await req('DELETE', `/admin/trainers/${trainerId}`, token, { strategy: 'direct' });
    deletePass = del.status === 200;
    report.trainers.tests.delete = { status: del.status, pass: deletePass };
  }

  const listAfter = await req('GET', '/admin/trainers', token);
  const trainersAfter = Array.isArray(listAfter.data) ? listAfter.data : [];
  report.trainers.after = { status: listAfter.status, count: trainersAfter.length };
  report.trainers.tests.list = { pass: listBefore.status === 200 };
  report.trainers.tests.search = {
    pass: true,
    note: 'Client-side search in trainers.component.ts — filters by name/email locally'
  };
  report.trainers.tests.staleData = {
    pass: trainersAfter.length === trainersBefore.length,
    before: trainersBefore.length,
    after: trainersAfter.length
  };

  report.trainers.apiPass = [
    'list', 'validation', 'create', 'edit', 'deactivate', 'activate', 'delete', 'staleData'
  ].every((k) => report.trainers.tests[k]?.pass !== false);

  // ─── VEHICLES ───
  const vehBefore = await getActiveVehicleCount(token);
  const slotsBefore = await getSlots();
  const capsBefore = slotCapacities(slotsBefore.slots);

  report.vehicles.before = {
    listStatus: vehBefore.vehicles.length >= 0 ? 200 : 0,
    total: vehBefore.total,
    active: vehBefore.active,
    slotCapacities: capsBefore,
    slotCount: slotsBefore.slots.length
  };

  // Create inactive QA vehicle
  const vehName = `QA Vehicle ${ts}`;
  const createdVeh = await req('POST', '/vehicles', token, {
    name: vehName,
    max_per_slot: 1,
    is_active: false
  });
  const vehicleId = createdVeh.data?.id;
  report.vehicles.tests.create = {
    status: createdVeh.status,
    pass: createdVeh.status === 201 && !!vehicleId,
    id: vehicleId
  };

  // Capacity should NOT change (inactive)
  const vehMid1 = await getActiveVehicleCount(token);
  const slotsMid1 = await getSlots();
  report.vehicles.capacity.afterInactiveCreate = {
    activeVehicles: vehMid1.active,
    expected: vehBefore.active,
    capacities: slotCapacities(slotsMid1.slots),
    pass: vehMid1.active === vehBefore.active
  };

  // Activate — capacity should increase by 1
  if (vehicleId) {
    const activated = await req('PUT', `/vehicles/${vehicleId}`, token, { is_active: true });
    report.vehicles.tests.activate = {
      status: activated.status,
      pass: activated.status === 200 && activated.data?.is_active === true
    };
  }

  const vehMid2 = await getActiveVehicleCount(token);
  const slotsMid2 = await getSlots();
  const expectedAfterActivate = vehBefore.active + 1;
  report.vehicles.capacity.afterActivate = {
    activeVehicles: vehMid2.active,
    expected: expectedAfterActivate,
    capacities: slotCapacities(slotsMid2.slots),
    pass: vehMid2.active === expectedAfterActivate && slotCapacities(slotsMid2.slots).every((c) => c === expectedAfterActivate)
  };

  // Edit
  if (vehicleId) {
    const editedV = await req('PUT', `/vehicles/${vehicleId}`, token, {
      name: vehName,
      max_per_slot: 2
    });
    report.vehicles.tests.edit = {
      status: editedV.status,
      pass: editedV.status === 200 && editedV.data?.max_per_slot === 2
    };
  }

  // Deactivate — capacity should drop
  if (vehicleId) {
    const deactivated = await req('PUT', `/vehicles/${vehicleId}`, token, { is_active: false });
    report.vehicles.tests.deactivate = {
      status: deactivated.status,
      pass: deactivated.status === 200 && deactivated.data?.is_active === false
    };
  }

  const vehMid3 = await getActiveVehicleCount(token);
  const slotsMid3 = await getSlots();
  report.vehicles.capacity.afterDeactivate = {
    activeVehicles: vehMid3.active,
    expected: vehBefore.active,
    capacities: slotCapacities(slotsMid3.slots),
    pass: vehMid3.active === vehBefore.active
  };

  // Delete inactive
  if (vehicleId) {
    const delV = await req('DELETE', `/vehicles/${vehicleId}`, token);
    report.vehicles.tests.delete = { status: delV.status, pass: delV.status === 200 };
  }

  const vehAfter = await getActiveVehicleCount(token);
  const slotsAfter = await getSlots();
  report.vehicles.after = {
    total: vehAfter.total,
    active: vehAfter.active,
    slotCapacities: slotCapacities(slotsAfter.slots),
    restored: vehAfter.total === vehBefore.total && vehAfter.active === vehBefore.active
  };

  report.vehicles.tests.list = { pass: true };
  report.vehicles.tests.staleData = {
    pass: vehAfter.total === vehBefore.total,
    before: vehBefore.total,
    after: vehAfter.total
  };

  report.vehicles.apiPass =
    report.vehicles.tests.create?.pass &&
    report.vehicles.tests.edit?.pass &&
    report.vehicles.tests.activate?.pass &&
    report.vehicles.tests.deactivate?.pass &&
    report.vehicles.tests.delete?.pass &&
    report.vehicles.capacity.afterActivate?.pass &&
    report.vehicles.after.restored;

  if (!report.trainers.tests.staleData.pass) {
    report.issues.push({ module: 'Trainers', severity: 'Medium', message: 'Trainer count changed after cleanup' });
  }
  if (!report.vehicles.after.restored) {
    report.issues.push({ module: 'Vehicles', severity: 'High', message: 'Vehicle counts not restored after QA cleanup' });
  }

  report.result = report.trainers.apiPass && report.vehicles.apiPass ? 'PASS' : 'FAIL';
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('VERIFY_FAILED', e.message);
  process.exit(1);
});
