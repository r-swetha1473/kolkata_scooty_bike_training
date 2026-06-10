/**
 * Enriches booking rows with display-friendly scheduled time fields.
 */
function formatSlotTimeIST(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function enrichBookingTimes(row) {
  const start = row.start_time || row.slot?.start_time || null;
  const end = row.end_time || row.slot?.end_time || null;
  const slotDate = row.slot_date || row.slot?.slot_date || null;

  return {
    ...row,
    start_time: start,
    end_time: end,
    slot_date: slotDate,
    slot_time: start,
    booking_datetime: start,
    formatted_slot_time: start ? formatSlotTimeIST(start) : null,
    formatted_slot_range:
      start && end
        ? `${formatSlotTimeIST(start)} – ${new Date(end).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`
        : start
          ? formatSlotTimeIST(start)
          : null
  };
}

module.exports = {
  formatSlotTimeIST,
  enrichBookingTimes
};
