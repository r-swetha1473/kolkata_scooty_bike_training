/**
 * Legacy vehicles.type column ('Scooty' | 'Bike').
 * Bookings and slot capacity use vehicle_id + name; type is kept for DB constraint compatibility only.
 */
function inferVehicleType(name) {
  const normalized = String(name || '').trim();
  if (!normalized) return 'Scooty';
  return /\bbike\b/i.test(normalized) ? 'Bike' : 'Scooty';
}

module.exports = { inferVehicleType };
