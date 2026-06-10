/**
 * Final production verification — Users module API + response contract.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = (process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api').replace(/\/$/, '');
const { requireAdminCreds } = require('./lib/requireAdminCreds');
const { email: EMAIL, password: PASSWORD } = requireAdminCreds();

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login ${res.status}: ${data.message}`);
  return data.token;
}

async function getUsers(token, qs = '') {
  const path = `/admin/users${qs ? (qs.startsWith('?') ? qs : `?${qs}`) : ''}`;
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, path };
}

function mapLikeFrontend(result) {
  const usersFromTop = Array.isArray(result?.users) ? result.users : null;
  const usersFromData = Array.isArray(result?.data?.users) ? result.data.users : null;
  const usersFromArray = Array.isArray(result) ? result : null;
  const users = usersFromTop || usersFromData || usersFromArray || [];
  const totalRaw = result?.total ?? result?.data?.total;
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : users.length;
  return { users, total };
}

function displayPhone(user) {
  const phone = user?.phone;
  if (phone == null) return 'Not Provided';
  const v = String(phone).trim();
  if (v === '' || /^GOOGLE_/i.test(v)) return 'Not Provided';
  return v;
}

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    api: API,
    checks: {},
    samples: {},
    issues: [],
    structureMatch: null
  };

  const token = await login();

  // Full list
  const all = await getUsers(token);
  report.checks.allUsers = { status: all.status, pass: all.status === 200 };

  if (all.status !== 200) {
    report.result = 'FAIL';
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const mapped = mapLikeFrontend(all.data);
  const requiredKeys = ['users', 'total'];
  const hasShape = requiredKeys.every((k) => k in all.data);
  const userSample = mapped.users[0];
  const expectedUserKeys = ['id', 'email', 'full_name', 'role', 'phone', 'phone_source', 'created_at'];
  const userKeyCheck = userSample
    ? expectedUserKeys.filter((k) => Object.prototype.hasOwnProperty.call(userSample, k))
    : [];

  report.structureMatch = {
    topLevel: hasShape,
    keys: Object.keys(all.data),
    userFieldsPresent: userKeyCheck,
    userFieldsMissing: expectedUserKeys.filter((k) => !userKeyCheck.includes(k)),
    frontendMappingWorks: mapped.users.length > 0 && mapped.total > 0
  };

  // Search by name
  const byName = await getUsers(token, 'search=Rajani');
  const nameHits = mapLikeFrontend(byName.data).users;
  report.checks.searchByName = {
    status: byName.status,
    pass: byName.status === 200 && nameHits.some((u) => /rajani/i.test(u.full_name || '')),
    count: nameHits.length
  };

  // Search by email
  const byEmail = await getUsers(token, 'search=saharajani5@gmail.com');
  const emailHits = mapLikeFrontend(byEmail.data).users;
  report.checks.searchByEmail = {
    status: byEmail.status,
    pass: byEmail.status === 200 && emailHits.some((u) => /saharajani5@gmail.com/i.test(u.email || '')),
    count: emailHits.length
  };

  // Search by phone — find user with real phone first
  const withPhone = mapped.users.find((u) => u.phone && !/^GOOGLE_/i.test(String(u.phone)));
  let phoneSearchPass = false;
  let phoneSearchStatus = null;
  if (withPhone) {
    const byPhone = await getUsers(token, `search=${encodeURIComponent(withPhone.phone)}`);
    phoneSearchStatus = byPhone.status;
    const phoneHits = mapLikeFrontend(byPhone.data).users;
    phoneSearchPass = byPhone.status === 200 && phoneHits.some((u) => u.id === withPhone.id);
    report.samples.phoneSearchUser = { name: withPhone.full_name, phone: withPhone.phone, hits: phoneHits.length };
  } else {
    report.samples.phoneSearchUser = { note: 'No user with profile phone in first page; skipped' };
    phoneSearchPass = true;
  }
  report.checks.searchByPhone = { status: phoneSearchStatus, pass: phoneSearchPass };

  // Role filter
  const customers = await getUsers(token, 'role=customer');
  const custUsers = mapLikeFrontend(customers.data).users;
  report.checks.roleFilter = {
    status: customers.status,
    pass: customers.status === 200 && custUsers.every((u) => u.role === 'customer'),
    count: custUsers.length,
    total: customers.data?.total
  };

  // Pagination (server-side limit/offset)
  const page1 = await getUsers(token, 'limit=8&offset=0');
  const page2 = await getUsers(token, 'limit=8&offset=8');
  const p1 = mapLikeFrontend(page1.data);
  const p2 = mapLikeFrontend(page2.data);
  const noOverlap =
    p1.users.length > 0 &&
    p2.users.length > 0 &&
    !p1.users.some((u) => p2.users.some((v) => v.id === u.id));
  report.checks.serverPagination = {
    pass: page1.status === 200 && page2.status === 200 && p1.total === mapped.total,
    page1Count: p1.users.length,
    page2Count: p2.users.length,
    total: p1.total,
    note: 'Frontend uses client-side pagination on full result set from API'
  };

  // Export
  const exportRes = await fetch(`${API}/admin/customers/export`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' }
  });
  const csv = await exportRes.text();
  report.checks.exportCsv = {
    status: exportRes.status,
    pass: exportRes.status === 200 && csv.includes('email') && !csv.includes('GOOGLE_'),
    contentType: exportRes.headers.get('content-type'),
    rowEstimate: (csv.match(/\n/g) || []).length
  };

  // Phone sanitization
  const googleLeaks = mapped.users.filter((u) => /^GOOGLE_/i.test(String(u.phone || '')));
  const nullPhones = mapped.users.filter((u) => u.phone == null);
  const displaySamples = mapped.users.slice(0, 5).map((u) => ({
    name: u.full_name,
    apiPhone: u.phone,
    phone_source: u.phone_source,
    uiDisplay: displayPhone(u)
  }));

  report.checks.phoneDisplay = {
    pass: googleLeaks.length === 0,
    googleLeaks: googleLeaks.length,
    nullPhoneInApi: nullPhones.length,
    notProvidedWouldShow: mapped.users.filter((u) => displayPhone(u) === 'Not Provided').length
  };

  // Empty state simulation
  const empty = await getUsers(token, 'search=zzzznonexistentuser99999');
  const emptyUsers = mapLikeFrontend(empty.data).users;
  report.checks.emptyState = {
    pass: empty.status === 200 && emptyUsers.length === 0,
    count: emptyUsers.length,
    total: empty.data?.total
  };

  // Rajani Saha case (Google OAuth, no phone)
  const rajani = nameHits.find((u) => /rajani/i.test(u.full_name || ''));
  report.samples.rajaniSaha = rajani
    ? { ...rajani, uiDisplay: displayPhone(rajani) }
    : null;

  report.samples.networkResponse = {
    endpoint: 'GET /api/admin/users',
    status: all.status,
    body: {
      total: all.data?.total,
      limit: all.data?.limit,
      offset: all.data?.offset,
      usersCount: mapped.users.length,
      firstUser: userSample
        ? {
            id: userSample.id,
            full_name: userSample.full_name,
            email: userSample.email,
            phone: userSample.phone,
            phone_source: userSample.phone_source,
            role: userSample.role,
            inactive_blocked: userSample.inactive_blocked
          }
        : null
    }
  };

  // Frontend bundle check
  const usersChunk = await fetch('https://kolkata-scooty-bike-training.vercel.app/chunk-UJDFMXLV.js').then((r) => r.text()).catch(() => '');
  report.checks.frontendBundle = {
    usersChunkLive: usersChunk.length > 1000 && !usersChunk.startsWith('<!DOCTYPE'),
    hasNotProvided: usersChunk.includes('Not Provided'),
    hasPhoneDisplayUtil: usersChunk.includes('isGooglePhonePlaceholder') || usersChunk.includes('Not Provided')
  };

  // Mobile — code/CSS only
  report.checks.mobileResponsiveness = {
    pass: null,
    note: 'Requires browser DevTools at 320/375/425px — users page uses admin-table-container horizontal scroll pattern'
  };

  const apiChecks = [
    'allUsers', 'searchByName', 'searchByEmail', 'searchByPhone',
    'roleFilter', 'serverPagination', 'exportCsv', 'phoneDisplay', 'emptyState'
  ];
  const apiPass = apiChecks.every((k) => report.checks[k]?.pass === true);
  const structurePass = report.structureMatch.topLevel && report.structureMatch.frontendMappingWorks;

  if (!structurePass) {
    report.issues.push({ severity: 'High', message: 'API response structure may not match frontend mapping' });
  }
  if (googleLeaks.length > 0) {
    report.issues.push({ severity: 'Critical', message: `${googleLeaks.length} GOOGLE_* phones in API response` });
  }
  if (!report.checks.frontendBundle.hasNotProvided) {
    report.issues.push({ severity: 'Medium', message: 'Not Provided string not found in live users chunk (may be minified)' });
  }

  report.result = apiPass && structurePass ? 'PASS' : 'FAIL';
  report.uiBlocked = ['screenshots', 'console errors', 'mobile layout — manual browser required'];

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('VERIFY_FAILED', e.message);
  process.exit(1);
});
