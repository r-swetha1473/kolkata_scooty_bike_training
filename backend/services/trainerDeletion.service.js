const db = require('../db');
const auditService = require('./audit.service');

const BLOCKING_STATUSES = ['pending', 'confirmed'];
const PAST_SLOT_DATE_SQL = `COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date) < (NOW() AT TIME ZONE 'Asia/Kolkata')::date`;

async function getTrainerRow(client, trainerId) {
  const result = await client.query(
    `SELECT t.id, t.user_id, t.is_active, p.full_name
     FROM trainers t
     JOIN profiles p ON t.user_id = p.id
     WHERE t.id = $1`,
    [trainerId]
  );
  return result.rows[0] || null;
}

async function getBookingSummary(client, trainerId) {
  const result = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE b.status NOT IN ('cancelled'))::int AS total_bookings,
       COUNT(*) FILTER (WHERE b.status = 'pending')::int AS pending_bookings,
       COUNT(*) FILTER (WHERE b.status = 'confirmed')::int AS active_bookings,
       COUNT(*) FILTER (WHERE b.status = 'completed')::int AS completed_bookings,
       COUNT(*) FILTER (WHERE b.status IN ('pending', 'confirmed'))::int AS blocking_bookings,
       COUNT(*) FILTER (
         WHERE b.status IN ('pending', 'confirmed') AND ${PAST_SLOT_DATE_SQL}
       )::int AS past_blocking_bookings,
       COUNT(*) FILTER (
         WHERE b.status IN ('pending', 'confirmed') AND NOT (${PAST_SLOT_DATE_SQL})
       )::int AS future_blocking_bookings
     FROM bookings b
     LEFT JOIN slots s ON b.slot_id = s.id
     WHERE b.trainer_id = $1`,
    [trainerId]
  );
  return result.rows[0];
}

async function getAvailableReassignTrainers(client, trainerId) {
  const result = await client.query(
    `SELECT t.id, p.full_name AS name
     FROM trainers t
     JOIN profiles p ON t.user_id = p.id
     WHERE t.is_active = true AND t.id != $1
     ORDER BY p.full_name`,
    [trainerId]
  );
  return result.rows;
}

async function getTrainerDeletePreview(trainerId) {
  const trainer = await getTrainerRow(db, trainerId);
  if (!trainer) {
    const error = new Error('Trainer not found');
    error.status = 404;
    error.errorCode = 'TRAINER_NOT_FOUND';
    throw error;
  }

  const summary = await getBookingSummary(db, trainerId);
  const availableReassignTrainers = await getAvailableReassignTrainers(db, trainerId);

  return {
    trainerId: trainer.id,
    trainerName: trainer.full_name,
    isActive: trainer.is_active,
    totalBookings: summary.total_bookings,
    pendingBookings: summary.pending_bookings,
    activeBookings: summary.active_bookings,
    completedBookings: summary.completed_bookings,
    blockingBookings: summary.blocking_bookings,
    pastBlockingBookings: summary.past_blocking_bookings,
    futureBlockingBookings: summary.future_blocking_bookings,
    canDeleteDirectly: !trainer.is_active && summary.blocking_bookings === 0,
    availableReassignTrainers
  };
}

async function findReassignConflicts(client, trainerId, reassignToTrainerId) {
  const result = await client.query(
    `SELECT b1.id, b1.slot_id
     FROM bookings b1
     WHERE b1.trainer_id = $1
       AND b1.status IN ('pending', 'confirmed')
       AND EXISTS (
         SELECT 1 FROM bookings b2
         WHERE b2.slot_id = b1.slot_id
           AND b2.trainer_id = $2
           AND b2.status NOT IN ('cancelled')
           AND b2.id <> b1.id
       )`,
    [trainerId, reassignToTrainerId]
  );
  return result.rows;
}

async function completePastBookings(client, trainerId, adminId) {
  const before = await client.query(
    `SELECT b.id, b.status
     FROM bookings b
     JOIN slots s ON b.slot_id = s.id
     WHERE b.trainer_id = $1
       AND b.status IN ('pending', 'confirmed')
       AND ${PAST_SLOT_DATE_SQL}`,
    [trainerId]
  );

  if (before.rows.length === 0) {
    return { pastCompletedCount: 0 };
  }

  const result = await client.query(
    `UPDATE bookings b
     SET status = 'completed', updated_at = NOW()
     FROM slots s
     WHERE b.slot_id = s.id
       AND b.trainer_id = $1
       AND b.status IN ('pending', 'confirmed')
       AND ${PAST_SLOT_DATE_SQL}
     RETURNING b.id`,
    [trainerId]
  );

  await auditService.logTrainerBookingsBulkComplete(adminId, trainerId, {
    bookingIds: before.rows.map((r) => r.id),
    previousStatuses: before.rows.map((r) => ({ id: r.id, status: r.status })),
    updatedCount: result.rows.length,
    scope: 'past_only'
  });

  return { pastCompletedCount: result.rows.length };
}

async function completeAllBookings(client, trainerId, adminId) {
  const before = await client.query(
    `SELECT id, status FROM bookings
     WHERE trainer_id = $1 AND status NOT IN ('completed', 'cancelled')`,
    [trainerId]
  );

  if (before.rows.length === 0) {
    return { updatedCount: 0 };
  }

  const result = await client.query(
    `UPDATE bookings
     SET status = 'completed', updated_at = NOW()
     WHERE trainer_id = $1 AND status NOT IN ('completed', 'cancelled')
     RETURNING id`,
    [trainerId]
  );

  await auditService.logTrainerBookingsBulkComplete(adminId, trainerId, {
    bookingIds: before.rows.map((r) => r.id),
    previousStatuses: before.rows.map((r) => ({ id: r.id, status: r.status })),
    updatedCount: result.rows.length,
    scope: 'all_non_completed'
  });

  return { updatedCount: result.rows.length };
}

async function reassignBlockingBookings(client, trainerId, reassignToTrainerId, adminId) {
  const conflicts = await findReassignConflicts(client, trainerId, reassignToTrainerId);
  if (conflicts.length > 0) {
    const error = new Error(
      'Cannot reassign bookings: the selected trainer already has bookings on one or more of the same slots. Choose another trainer or mark bookings as completed.'
    );
    error.status = 409;
    error.errorCode = 'REASSIGN_CONFLICT';
    error.conflictCount = conflicts.length;
    throw error;
  }

  const before = await client.query(
    `SELECT id, slot_id, status FROM bookings
     WHERE trainer_id = $1 AND status IN ('pending', 'confirmed')`,
    [trainerId]
  );

  if (before.rows.length === 0) {
    return { reassignedCount: 0 };
  }

  const result = await client.query(
    `UPDATE bookings
     SET trainer_id = $2, updated_at = NOW()
     WHERE trainer_id = $1 AND status IN ('pending', 'confirmed')
     RETURNING id`,
    [trainerId, reassignToTrainerId]
  );

  await auditService.logTrainerBookingsReassign(adminId, trainerId, reassignToTrainerId, {
    bookingIds: before.rows.map((r) => r.id),
    reassignedCount: result.rows.length
  });

  return { reassignedCount: result.rows.length };
}

async function removeTrainerRecord(client, trainer) {
  const deleteResult = await client.query(
    'DELETE FROM trainers WHERE id = $1 RETURNING *',
    [trainer.id]
  );

  await client.query(
    `UPDATE profiles SET role = 'customer', updated_at = NOW() WHERE id = $1`,
    [trainer.user_id]
  );

  return deleteResult.rows[0];
}

async function deleteTrainerWithStrategy({ trainerId, adminId, strategy, reassignToTrainerId }) {
  const client = await db.pool.connect();
  try {
    const trainer = await getTrainerRow(client, trainerId);
    if (!trainer) {
      const error = new Error('Trainer not found');
      error.status = 404;
      error.errorCode = 'TRAINER_NOT_FOUND';
      throw error;
    }

    if (trainer.is_active) {
      const error = new Error('Cannot delete an active trainer. Deactivate the trainer first.');
      error.status = 400;
      error.errorCode = 'TRAINER_IS_ACTIVE';
      throw error;
    }

    const summary = await getBookingSummary(client, trainerId);
    const blocking = summary.blocking_bookings;

    if (strategy === 'direct') {
      if (blocking > 0) {
        const error = new Error(
          'This trainer has existing bookings. Please complete or reassign them before deleting.'
        );
        error.status = 400;
        error.errorCode = 'TRAINER_HAS_BOOKINGS';
        throw error;
      }
    } else if (strategy === 'complete_all') {
      // allowed when bookings exist
    } else if (strategy === 'complete_past') {
      const pastBlocking = summary.past_blocking_bookings;
      if (pastBlocking === 0) {
        const error = new Error('No past pending or confirmed bookings to mark as completed');
        error.status = 400;
        error.errorCode = 'NO_PAST_BOOKINGS';
        throw error;
      }
    } else if (strategy === 'reassign') {
      if (!reassignToTrainerId) {
        const error = new Error('reassignToTrainerId is required for reassignment');
        error.status = 400;
        error.errorCode = 'MISSING_REASSIGN_TRAINER';
        throw error;
      }
      if (reassignToTrainerId === trainerId) {
        const error = new Error('Cannot reassign bookings to the same trainer');
        error.status = 400;
        error.errorCode = 'INVALID_REASSIGN_TRAINER';
        throw error;
      }
      const target = await getTrainerRow(client, reassignToTrainerId);
      if (!target || !target.is_active) {
        const error = new Error('Reassignment target trainer not found or inactive');
        error.status = 400;
        error.errorCode = 'INVALID_REASSIGN_TRAINER';
        throw error;
      }
      if (blocking === 0) {
        const error = new Error('No active or pending bookings to reassign');
        error.status = 400;
        error.errorCode = 'NO_BOOKINGS_TO_REASSIGN';
        throw error;
      }
    } else {
      const error = new Error('Invalid delete strategy');
      error.status = 400;
      error.errorCode = 'INVALID_STRATEGY';
      throw error;
    }

    await client.query('BEGIN');

    let actionDetails = {};
    if (strategy === 'complete_all') {
      actionDetails = await completeAllBookings(client, trainerId, adminId);
    } else if (strategy === 'complete_past') {
      actionDetails = await completePastBookings(client, trainerId, adminId);
    } else if (strategy === 'reassign') {
      actionDetails = await reassignBlockingBookings(client, trainerId, reassignToTrainerId, adminId);
    }

    const remainingBlocking = await getBookingSummary(client, trainerId);
    if (remainingBlocking.blocking_bookings > 0) {
      if (strategy === 'complete_past') {
        await client.query('COMMIT');
        return {
          message: `Marked ${actionDetails.pastCompletedCount || 0} past booking(s) as completed. ${remainingBlocking.blocking_bookings} future booking(s) still need attention before deleting this trainer.`,
          deleted: false,
          canDeleteNow: false,
          strategy,
          pastCompletedCount: actionDetails.pastCompletedCount || 0,
          remainingBlocking: remainingBlocking.blocking_bookings,
          futureBlockingBookings: remainingBlocking.future_blocking_bookings
        };
      }

      const error = new Error(
        'This trainer still has active or pending bookings. Please complete or reassign them before deleting.'
      );
      error.status = 400;
      error.errorCode = 'TRAINER_HAS_BOOKINGS';
      throw error;
    }

    const deleted = await removeTrainerRecord(client, trainer);
    await auditService.logTrainerDelete(adminId, trainer, { strategy, ...actionDetails });

    await client.query('COMMIT');

    const successMessage =
      strategy === 'complete_past'
        ? `Marked ${actionDetails.pastCompletedCount || 0} past booking(s) as completed and deleted trainer`
        : 'Trainer deleted successfully';

    return {
      message: successMessage,
      deleted: true,
      canDeleteNow: true,
      deletedTrainer: deleted,
      strategy,
      ...actionDetails
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getTrainerDeletePreview,
  deleteTrainerWithStrategy
};
