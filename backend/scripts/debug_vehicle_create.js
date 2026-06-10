const API = 'https://kolkata-scooty-bike-training.onrender.com/api';
const ts = Date.now();
(async () => {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kolkatascotty.com', password: 'admin123' })
  }).then((r) => r.json());
  const token = login.token;
  const body = { name: `QA Vehicle ${ts}`, max_per_slot: 1, is_active: false };
  const res = await fetch(`${API}/vehicles`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  console.log('status', res.status);
  console.log('body sent', body);
  console.log('response', text);
  if (res.ok) {
    const id = JSON.parse(text).id;
    await fetch(`${API}/vehicles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  }
})();
