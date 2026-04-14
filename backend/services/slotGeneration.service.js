/**
 * Centralized slot grid generation (admin + automated cron).
 * Round-robin assigns active trainers so slots are bookable without manual assignment.
 */

const db = require('../db');
const config = require('../app.config');
const { SLOT_CAPACITY, SLOT_VISIBILITY_HOURS } = require('../config/app.config');
const vehicleService = require('./vehicle.service');
const events = require('../events');
const { normalizeDate, addDays, getDayOfWeek, getToday } = require('../utils/dateUtils');

async function fetchActiveTrainerIds(client) {
  const r = await client.query(
    `SELECT id FROM trainers WHERE is_active = true ORDER BY created_at ASC NULLS LAST, id ASC`
  );
  return r.rows.map((row) => row.id);
}

function buildSlotTemplatesForDate(dateString, trainerIds) {
  const dayOfWeek = getDayOfWeek(dateString);
  const [year, month, day] = dateString.split('-').map(Number);
  const slots = [];
  let slotSeq = 0;

  const convertISTToUTC = (hoursIST, minutesIST) => {
    let hoursUTC = hoursIST - 5;
    let minutesUTC = minutesIST - 30;
    if (minutesUTC < 0) {
      minutesUTC += 60;
      hoursUTC -= 1;
    }
    if (hoursUTC < 0) {
      hoursUTC += 24;
    }
    return { hours: hoursUTC, minutes: minutesUTC };
  };

  const pushSlot = (slotStart, slotEnd) => {
    const now = new Date();
    const visibilityThreshold = new Date(now.getTime() + SLOT_VISIBILITY_HOURS * 60 * 60 * 1000);
    const isVisible = slotStart > now && slotStart <= visibilityThreshold;
    const trainer_id =
      trainerIds.length > 0 ? trainerIds[slotSeq % trainerIds.length] : null;
    slotSeq += 1;
    slots.push({
      trainer_id,
      start_time: slotStart.toISOString(),
      end_time: slotEnd.toISOString(),
      capacity: SLOT_CAPACITY.DEFAULT,
      booked_count: 0,
      status: config.slot.defaultStatus,
      slot_date: dateString,
      is_auto_generated: true,
      is_visible: isVisible
    });
  };

  if (dayOfWeek >= 1 && dayOfWeek <= 6) {
    const weekdayConfig = config.slot.generation.weekday;
    const startMinutes = weekdayConfig.startHour * 60;
    const endMinutes = weekdayConfig.endHour * 60;
    const intervalMinutes = weekdayConfig.intervalMinutes;
    let currentStartMinutes = startMinutes;

    while (currentStartMinutes + intervalMinutes <= endMinutes) {
      const slotStartMinutes = currentStartMinutes;
      const slotEndMinutes = currentStartMinutes + intervalMinutes;
      const startHoursIST = Math.floor(slotStartMinutes / 60);
      const startMinsIST = slotStartMinutes % 60;
      const endHoursIST = Math.floor(slotEndMinutes / 60);
      const endMinsIST = slotEndMinutes % 60;
      const startUTC = convertISTToUTC(startHoursIST, startMinsIST);
      const endUTC = convertISTToUTC(endHoursIST, endMinsIST);
      const slotStart = new Date(Date.UTC(year, month - 1, day, startUTC.hours, startUTC.minutes, 0, 0));
      const slotEnd = new Date(Date.UTC(year, month - 1, day, endUTC.hours, endUTC.minutes, 0, 0));
      currentStartMinutes += intervalMinutes;
      pushSlot(slotStart, slotEnd);
    }
  } else if (dayOfWeek === 0) {
    const sundayConfig = config.slot.generation.sunday;
    const morningEndMinutes = 12 * 60 + 30;
    const morningSlotInterval = 30;

    for (const time of sundayConfig.morning) {
      const startMinutes = time.hour * 60 + time.minute;
      const endMinutes = startMinutes + morningSlotInterval;
      if (endMinutes > morningEndMinutes) {
        break;
      }
      const startHours = Math.floor(startMinutes / 60);
      const startMins = startMinutes % 60;
      const endHoursIST = Math.floor(endMinutes / 60);
      const endMinsIST = endMinutes % 60;
      const startUTC = convertISTToUTC(startHours, startMins);
      const endUTC = convertISTToUTC(endHoursIST, endMinsIST);
      const slotStart = new Date(Date.UTC(year, month - 1, day, startUTC.hours, startUTC.minutes, 0, 0));
      const slotEnd = new Date(Date.UTC(year, month - 1, day, endUTC.hours, endUTC.minutes, 0, 0));
      pushSlot(slotStart, slotEnd);
    }

    const eveningStartMinutes = sundayConfig.evening.startHour * 60;
    const eveningEndMinutes = sundayConfig.evening.endHour * 60;
    const eveningIntervalMinutes = sundayConfig.evening.intervalMinutes;
    let currentEveningStartMinutes = eveningStartMinutes;

    while (currentEveningStartMinutes + eveningIntervalMinutes <= eveningEndMinutes) {
      const slotStartMinutes = currentEveningStartMinutes;
      const slotEndMinutes = currentEveningStartMinutes + eveningIntervalMinutes;
      const startHoursIST = Math.floor(slotStartMinutes / 60);
      const startMinsIST = slotStartMinutes % 60;
      const endHoursIST = Math.floor(slotEndMinutes / 60);
      const endMinsIST = slotEndMinutes % 60;
      const startUTC = convertISTToUTC(startHoursIST, startMinsIST);
      const endUTC = convertISTToUTC(endHoursIST, endMinsIST);
      const slotStart = new Date(Date.UTC(year, month - 1, day, startUTC.hours, startUTC.minutes, 0, 0));
      const slotEnd = new Date(Date.UTC(year, month - 1, day, endUTC.hours, endUTC.minutes, 0, 0));
      currentEveningStartMinutes += eveningIntervalMinutes;
      pushSlot(slotStart, slotEnd);
    }
  }

  return { slots, dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek] };
}

/**
 * @param {string} dateString YYYY-MM-DD
 * @param {object} options
 * @param {'admin'|'auto'} options.mode
 * @param {boolean} [options.force]
 * @param {string|null} [options.actorProfileId] profiles.id for admin (audit / payload only)
 * @returns {Promise<object>}
 */
async function generateSlotsForDate(dateString, options = {}) {
  const mode = options.mode || 'admin';
  const force = !!options.force;
  const actorProfileId = options.actorProfileId ?? null;

  const dateNorm = normalizeDate(dateString);
  const todayStr = getToday();

  if (dateNorm < todayStr) {
    const err = new Error(
      `Slot generation is not allowed for past dates. Requested: ${dateNorm}; today: ${todayStr}.`
    );
    err.status = 400;
    err.errorCode = 'GENERATE_DATE_IN_PAST';
    err.suggestedDate = todayStr;
    err.requestedDate = dateNorm;
    throw err;
  }

  const client = await db.getClient();
  let released = false;
  const releaseOnce = () => {
    if (!released) {
      client.release();
      released = true;
    }
  };

  try {
    await client.query('BEGIN');

    if (mode === 'admin') {
      const existingSlotsCheck = await client.query(
        `
        SELECT COUNT(*) as count
        FROM slots
        WHERE slot_date = $1::date AND is_auto_generated = true
        `,
        [dateNorm]
      );
      const existingCount = parseInt(existingSlotsCheck.rows[0]?.count || 0, 10);

      if (existingCount > 0 && !force) {
        await client.query('ROLLBACK');
        releaseOnce();

        let nextDate = addDays(dateNorm, 1);
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
          const checkResult = await db.query(
            `SELECT COUNT(*) as count FROM slots WHERE slot_date = $1::date AND is_auto_generated = true`,
            [nextDate]
          );

          if (parseInt(checkResult.rows[0]?.count || 0, 10) === 0) {
            const error = new Error(`Slots already exist for ${dateNorm}. Next available date: ${nextDate}`);
            error.status = 409;
            error.errorCode = 'SLOTS_ALREADY_EXIST';
            error.nextAvailableDate = nextDate;
            error.existingDate = dateNorm;
            throw error;
          }

          nextDate = addDays(nextDate, 1);
          attempts++;
        }

        const error = new Error(
          `Slots already exist for ${dateNorm}. No available date found within 30 days.`
        );
        error.status = 409;
        error.errorCode = 'SLOTS_ALREADY_EXIST';
        error.existingDate = dateNorm;
        throw error;
      }
    }

    const vehicles = await vehicleService.getActiveVehicles();
    if (vehicles.length === 0) {
      await client.query('ROLLBACK');
      releaseOnce();
      const error = new Error('No active vehicles found. Please create vehicles first.');
      error.status = 400;
      error.errorCode = 'NO_VEHICLES';
      throw error;
    }

    const trainerIds = await fetchActiveTrainerIds(client);
    const { slots, dayName } = buildSlotTemplatesForDate(dateNorm, trainerIds);

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const slot of slots) {
      try {
        const existing = await client.query(
          `
          SELECT id, capacity, booked_count, trainer_id
          FROM slots
          WHERE slot_date = $1 AND start_time = $2
          LIMIT 1
          `,
          [slot.slot_date, slot.start_time]
        );

        if (existing.rows.length > 0) {
          await client.query(
            `
            UPDATE slots
            SET is_visible = $1,
                updated_at = NOW()
            WHERE id = $2
            `,
            [slot.is_visible, existing.rows[0].id]
          );

          try {
            const tableCheck = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'slot_vehicle_capacity'
              ) as exists
            `);
            if (tableCheck.rows[0]?.exists) {
              await client.query('SELECT ensure_slot_vehicle_capacities($1)', [existing.rows[0].id]);
            }
          } catch (funcError) {
            if (!funcError.message.includes('does not exist')) {
              console.warn(`[slotGeneration] ensure capacities: ${funcError.message}`);
            }
          }
          updatedCount++;
        } else {
          const insertResult = await client.query(
            `
            INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status, slot_date, is_auto_generated, is_visible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
            `,
            [
              slot.trainer_id,
              slot.start_time,
              slot.end_time,
              slot.capacity,
              slot.booked_count,
              slot.status,
              slot.slot_date,
              slot.is_auto_generated,
              slot.is_visible
            ]
          );

          const slotId = insertResult.rows[0].id;

          try {
            const tableCheck = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'slot_vehicle_capacity'
              ) as exists
            `);

            if (tableCheck.rows[0]?.exists) {
              for (const vehicle of vehicles) {
                await client.query(
                  `
                  INSERT INTO slot_vehicle_capacity (slot_id, vehicle_id, capacity)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (slot_id, vehicle_id) DO UPDATE SET capacity = EXCLUDED.capacity
                  `,
                  [slotId, vehicle.id, vehicle.max_per_slot]
                );
              }
              await client.query('SELECT ensure_slot_vehicle_capacities($1)', [slotId]);
            }
          } catch (capacityError) {
            if (capacityError.code === '42P01' || capacityError.message.includes('does not exist')) {
              /* skip */
            } else {
              throw capacityError;
            }
          }

          insertedCount++;
        }
      } catch (error) {
        if (error.code === '23505' || String(error.message || '').includes('duplicate key')) {
          skippedCount++;
          continue;
        }
        throw error;
      }
    }

    const slotsToUpdate = await client.query(
      `SELECT id FROM slots WHERE slot_date = $1::date`,
      [dateNorm]
    );

    for (const slotRow of slotsToUpdate.rows) {
      try {
        await client.query('SELECT ensure_slot_vehicle_capacities($1)', [slotRow.id]);
      } catch (e) {
        if (!String(e.message || '').includes('does not exist')) {
          console.warn(`[slotGeneration] ensure_slot_vehicle_capacities: ${e.message}`);
        }
      }
    }

    await client.query(
      `
      UPDATE slots s
      SET capacity = $1,
      updated_at = NOW()
      WHERE slot_date = $2::date
        AND booked_count <= $3
      `,
      [SLOT_CAPACITY.DEFAULT, dateNorm, SLOT_CAPACITY.MAX]
    );

    await client.query('COMMIT');
    releaseOnce();

    const payload = {
      success: true,
      status: 'GENERATED',
      message: `Processed ${slots.length} slots for ${dateNorm}: ${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped`,
      slotsCreated: insertedCount,
      slotsUpdated: updatedCount,
      slotsSkipped: skippedCount,
      totalProcessed: slots.length,
      date: dateNorm,
      dayName,
      adminId: actorProfileId,
      mode
    };

    events.broadcast('slot.generated', payload);
    return payload;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    releaseOnce();
  }
}

/**
 * Nightly job (default 12:00 AM Asia/Kolkata): ensure today through the next 6 days
 * (7 calendar days total) each have the slot grid.
 */
async function runNightlyAutoGeneration() {
  const today = getToday();
  const results = [];
  const errors = [];

  for (let i = 0; i < 7; i++) {
    const dateStr = addDays(today, i);
    try {
      const r = await generateSlotsForDate(dateStr, { mode: 'auto', force: false });
      results.push(r);
    } catch (e) {
      errors.push({ date: dateStr, message: e.message, code: e.errorCode });
    }
  }

  const summary = { success: errors.length === 0, results, errors };
  events.broadcast('slot.auto_generated_batch', summary);
  return summary;
}

/**
 * Startup safety net:
 * ensures today + next N-1 days each have slots, and generates only missing dates.
 * Uses PostgreSQL advisory lock so parallel app instances do not run this simultaneously.
 */
async function ensureSlotsOnStartup(daysAhead = 7) {
  const client = await db.getClient();
  const lockKey = 9042001;
  let lockAcquired = false;

  try {
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [lockKey]);
    lockAcquired = !!lockRes.rows[0]?.locked;
    if (!lockAcquired) {
      return {
        success: true,
        skipped: true,
        reason: 'startup lock already held by another instance',
        checkedDays: daysAhead,
        generatedDates: [],
        existingDates: []
      };
    }

    const today = getToday();
    const generatedDates = [];
    const existingDates = [];
    const errors = [];

    for (let i = 0; i < daysAhead; i++) {
      const dateStr = addDays(today, i);
      try {
        const existing = await client.query(
          `SELECT COUNT(*)::int AS count FROM slots WHERE slot_date = $1::date`,
          [dateStr]
        );
        const count = existing.rows[0]?.count || 0;
        if (count > 0) {
          existingDates.push({ date: dateStr, count });
          continue;
        }

        await generateSlotsForDate(dateStr, { mode: 'auto', force: false });
        generatedDates.push(dateStr);
      } catch (e) {
        errors.push({ date: dateStr, message: e.message, code: e.errorCode });
      }
    }

    const summary = {
      success: errors.length === 0,
      skipped: false,
      checkedDays: daysAhead,
      generatedDates,
      existingDates,
      errors
    };
    events.broadcast('slot.startup_ensured', summary);
    return summary;
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]).catch(() => {});
    }
    client.release();
  }
}

module.exports = {
  generateSlotsForDate,
  runNightlyAutoGeneration,
  ensureSlotsOnStartup,
  fetchActiveTrainerIds
};
