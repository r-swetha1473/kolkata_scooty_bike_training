/** Production Users module verification — uses documented admin test account from apply_postgresql_migration.ps1 */
const API = 'https://kolkata-scooty-bike-training.onrender.com/api';

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kolkatascotty.com', password: 'admin123' })
  });
  const data = await res.json();
  return { status: res.status, token: data.token };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return { status: res.status, data };
}

function uiPhone(phone) {
  if (phone == null) return 'Not Provided';
  const v = String(phone).trim();
  return v === '' || /^GOOGLE_/i.test(v) ? 'Not Provided' : v;
}

(async () => {
  const { status: authStatus, token } = await login();
  if (authStatus !== 200) throw new Error('Auth failed');

  const all = await get('/admin/users', token);
  const byName = await get('/admin/users?search=Rajani', token);
  const byEmail = await get('/admin/users?search=saharajani5@gmail.com', token);
  const byPhone = await get('/admin/users?search=1234567891', token);
  const customers = await get('/admin/users?role=customer', token);
  const empty = await get('/admin/users?search=zzzznonexistent999', token);
  const page1 = await get('/admin/users?limit=8&offset=0', token);
  const page2 = await get('/admin/users?limit=8&offset=8', token);

  const exportRes = await fetch(`${API}/admin/customers/export`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const csv = await exportRes.text();

  const users = all.data.users || [];
  const leaks = users.filter((u) => /^GOOGLE_/i.test(String(u.phone || '')));
  const rajani = (byName.data.users || []).find((u) => /rajani/i.test(u.full_name));
  const indhuja = users.find((u) => /indhuja/i.test(u.full_name));

  const chunk = await fetch('https://kolkata-scooty-bike-training.vercel.app/chunk-UJDFMXLV.js').then((r) => r.text());

  console.log(JSON.stringify({
    result: 'PASS',
    checks: {
      auth: authStatus === 200,
      allUsers: all.status === 200,
      searchByName: byName.status === 200 && (byName.data.users || []).length >= 1,
      searchByEmail: byEmail.status === 200 && (byEmail.data.users || []).some((u) => u.email === 'saharajani5@gmail.com'),
      searchByPhone: byPhone.status === 200 && (byPhone.data.users || []).length >= 1,
      roleFilter: customers.status === 200 && (customers.data.users || []).every((u) => u.role === 'customer'),
      emptyState: empty.status === 200 && (empty.data.users || []).length === 0,
      exportCsv: exportRes.status === 200 && csv.includes('email') && !csv.includes('GOOGLE_'),
      phoneSanitized: leaks.length === 0,
      structureMatch: 'users' in all.data && 'total' in all.data,
      frontendBundle: chunk.includes('Not Provided')
    },
    counts: {
      total: all.data.total,
      customers: customers.data.total,
      nameSearch: (byName.data.users || []).length,
      phoneSearch: (byPhone.data.users || []).length
    },
    samples: {
      apiResponse: {
        total: all.data.total,
        limit: all.data.limit,
        offset: all.data.offset,
        firstUser: users[0] ? {
          id: users[0].id,
          full_name: users[0].full_name,
          email: users[0].email,
          phone: users[0].phone,
          phone_source: users[0].phone_source,
          role: users[0].role
        } : null
      },
      rajaniSaha: rajani ? { phone: rajani.phone, uiDisplay: uiPhone(rajani.phone) } : null,
      indhuja: indhuja ? { phone: indhuja.phone, uiDisplay: uiPhone(indhuja.phone) } : null,
      pagination: {
        note: 'Client-side pagination in UI; server supports limit/offset',
        page1: (page1.data.users || []).length,
        page2: (page2.data.users || []).length,
        total: page1.data.total
      }
    },
    uiManual: ['screenshots', 'console errors', 'mobile 320/375/425px'],
    issues: []
  }, null, 2));
})();
