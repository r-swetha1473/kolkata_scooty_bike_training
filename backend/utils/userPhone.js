/**
 * Phone display helpers for admin user listings.
 * Google OAuth placeholder values (GOOGLE_*) must never be shown as phone numbers.
 */

function isGooglePlaceholder(phone) {
  if (phone == null || phone === undefined) return true;
  const value = String(phone).trim();
  return value === '' || /^GOOGLE_/i.test(value);
}

function sanitizePhoneValue(phone) {
  if (isGooglePlaceholder(phone)) return null;
  return String(phone).trim();
}

/**
 * Resolves display phone from profile + optional latest booking phone.
 */
function resolveDisplayPhone(profilePhone, bookingPhone) {
  const fromProfile = sanitizePhoneValue(profilePhone);
  if (fromProfile) {
    return { phone: fromProfile, phone_source: 'profile' };
  }
  const fromBooking = sanitizePhoneValue(bookingPhone);
  if (fromBooking) {
    return { phone: fromBooking, phone_source: 'booking' };
  }
  return { phone: null, phone_source: null };
}

/**
 * Normalizes user rows from SQL (strips GOOGLE_* placeholders, sets phone_source).
 */
function enrichUsersWithDisplayPhone(rows) {
  let missingPhone = 0;
  let bookingPhoneCount = 0;
  let profilePhoneCount = 0;

  const users = (rows || []).map((row) => {
    const resolved = resolveDisplayPhone(
      row.profile_phone ?? row.phone,
      row.latest_booking_phone
    );

    if (resolved.phone_source === 'profile') profilePhoneCount += 1;
    else if (resolved.phone_source === 'booking') bookingPhoneCount += 1;
    else missingPhone += 1;

    const { profile_phone, latest_booking_phone, phone_raw, ...rest } = row;
    return {
      ...rest,
      phone: resolved.phone,
      phone_source: resolved.phone_source
    };
  });

  return {
    users,
    stats: {
      total: users.length,
      missingPhone,
      bookingPhoneCount,
      profilePhoneCount
    }
  };
}

module.exports = {
  isGooglePlaceholder,
  sanitizePhoneValue,
  resolveDisplayPhone,
  enrichUsersWithDisplayPhone
};
