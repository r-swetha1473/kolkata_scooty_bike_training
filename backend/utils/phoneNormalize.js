/**
 * Normalize stored or user-entered Indian mobile numbers to 10 ASCII digits.
 * Handles +91, leading 0, and digit-only strings from the DB.
 */
function normalizeIndianMobileDigits(input) {
  if (input == null) return '';
  const raw = String(input).trim();
  if (raw === '') return '';
  let d = raw.replace(/\D/g, '');
  if (d.length === 0) return '';
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  else if (d.length > 10) d = d.slice(-10);
  return d;
}

module.exports = { normalizeIndianMobileDigits };
