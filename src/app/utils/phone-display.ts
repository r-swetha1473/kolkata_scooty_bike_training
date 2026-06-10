/** Returns true when value is empty or a Google OAuth placeholder (GOOGLE_*). */
export function isGooglePhonePlaceholder(phone: unknown): boolean {
  if (phone == null) return true;
  const value = String(phone).trim();
  return value === '' || /^GOOGLE_/i.test(value);
}

/** Admin Users table: show real phone or "Not Provided". */
export function formatUserPhoneDisplay(phone: unknown): string {
  if (isGooglePhonePlaceholder(phone)) {
    return 'Not Provided';
  }
  return String(phone).trim();
}
