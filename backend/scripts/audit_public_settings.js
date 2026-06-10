/**
 * Audit GET /api/settings public exposure (keys + sensitivity).
 * Usage: node scripts/audit_public_settings.js [API_BASE]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = (process.argv[2] || process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api').replace(/\/$/, '');

const { PUBLIC_SETTINGS_KEYS, isPublicSettingsKey } = require('../utils/publicSettings');
const PUBLIC_SITE_KEYS = new Set(PUBLIC_SETTINGS_KEYS);

async function main() {
  const res = await fetch(`${API}/settings`);
  const data = await res.json();
  const keys = Object.keys(data).sort();

  const report = {
    endpoint: `${API}/settings`,
    status: res.status,
    keyCount: keys.length,
    keys,
    publicSiteKeys: keys.filter((k) => PUBLIC_SITE_KEYS.has(k)),
    nonPublicKeys: keys.filter((k) => !isPublicSettingsKey(k)),
    leakedOperationalKeys: keys.filter((k) => !isPublicSettingsKey(k)),
    exposedValues: {}
  };

  for (const key of keys) {
    report.exposedValues[key] = data[key];
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
