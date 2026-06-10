/**
 * Site settings safe to expose via unauthenticated GET /api/settings.
 * Operational/admin keys must not be included here.
 */
const PUBLIC_SETTINGS_KEYS = [
  'site_name',
  'site_logo',
  'contact_email',
  'contact_phone',
  'contact_address',
  'social_facebook',
  'social_instagram',
  'social_youtube',
  'footer_copyright',
  'about_text'
];

function isPublicSettingsKey(key) {
  return PUBLIC_SETTINGS_KEYS.includes(String(key || '').trim());
}

function filterPublicSettings(rows) {
  const settings = {};
  for (const row of rows) {
    if (isPublicSettingsKey(row.key)) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

module.exports = {
  PUBLIC_SETTINGS_KEYS,
  isPublicSettingsKey,
  filterPublicSettings
};
