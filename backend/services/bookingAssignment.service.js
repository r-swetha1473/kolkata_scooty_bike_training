/**
 * Server-side trainer & vehicle assignment for bookings.
 * Keeps POST /api/bookings to slot-only input while enforcing capacity & one-trainer-per-slot rules inside the transaction.
 */

/**
 * @param {import('pg').PoolClient} client
 * @param {string} slotId
 * @returns {Promise<{ ok: true, trainerId: string } | { ok: false, code: string }>}
 */
async function assignTrainerForSlot(client, slotId) {
  const slotRes = await client.query(
    `SELECT id, trainer_id FROM slots WHERE id = $1 FOR UPDATE NOWAIT`,
    [slotId]
  );

  if (slotRes.rows.length === 0) {
    return { ok: false, code: 'SLOT_NOT_FOUND' };
  }

  const slotTrainerId = slotRes.rows[0].trainer_id;

  if (slotTrainerId) {
    const useAssigned = await client.query(
      `SELECT t.id
       FROM trainers t
       WHERE t.id = $1
         AND t.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.slot_id = $2
             AND b.trainer_id = t.id
             AND b.status NOT IN ('cancelled')
         )`,
      [slotTrainerId, slotId]
    );
    if (useAssigned.rows.length > 0) {
      return { ok: true, trainerId: useAssigned.rows[0].id };
    }
  }

  const auto = await client.query(
    `SELECT t.id
     FROM trainers t
     WHERE t.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.slot_id = $1
           AND b.trainer_id = t.id
           AND b.status NOT IN ('cancelled')
       )
     ORDER BY t.created_at ASC NULLS LAST, t.id ASC
     LIMIT 1`,
    [slotId]
  );

  if (auto.rows.length === 0) {
    return { ok: false, code: 'NO_TRAINER_AVAILABLE' };
  }

  return { ok: true, trainerId: auto.rows[0].id };
}

/**
 * First active vehicle (by name) with remaining capacity on this slot.
 * @param {import('pg').PoolClient} client
 * @param {string} slotId
 * @returns {Promise<{ ok: true, vehicleId: string } | { ok: false, code: string }>}
 */
async function assignVehicleForSlot(client, slotId) {
  let vehicles;
  try {
    vehicles = await client.query(
      `SELECT v.id,
              COALESCE(
                (SELECT svc.capacity FROM slot_vehicle_capacity svc
                 WHERE svc.slot_id = $1 AND svc.vehicle_id = v.id),
                v.max_per_slot
              ) AS cap
       FROM vehicles v
       WHERE v.is_active = true
       ORDER BY v.name ASC`,
      [slotId]
    );
  } catch (e) {
    if (e.code === '42P01') {
      vehicles = await client.query(
        `SELECT v.id, v.max_per_slot AS cap
         FROM vehicles v
         WHERE v.is_active = true
         ORDER BY v.name ASC`
      );
    } else {
      throw e;
    }
  }

  for (const row of vehicles.rows) {
    const cap = parseInt(row.cap, 10) || 0;
    if (cap <= 0) continue;

    const booked = await client.query(
      `SELECT COUNT(*)::int AS c
       FROM bookings
       WHERE slot_id = $1
         AND vehicle_id = $2
         AND status NOT IN ('cancelled')`,
      [slotId, row.id]
    );
    const c = booked.rows[0]?.c ?? 0;
    if (c < cap) {
      return { ok: true, vehicleId: row.id };
    }
  }

  return { ok: false, code: 'NO_VEHICLE_CAPACITY' };
}

/**
 * Lock slot and resolve trainer + vehicle.
 * @param {import('pg').PoolClient} client
 * @param {string} slotId
 */
async function assignTrainerAndVehicleForSlot(client, slotId) {
  const t = await assignTrainerForSlot(client, slotId);
  if (!t.ok) return t;

  const v = await assignVehicleForSlot(client, slotId);
  if (!v.ok) return v;

  return { ok: true, trainerId: t.trainerId, vehicleId: v.vehicleId };
}

module.exports = {
  assignTrainerForSlot,
  assignVehicleForSlot,
  assignTrainerAndVehicleForSlot
};
