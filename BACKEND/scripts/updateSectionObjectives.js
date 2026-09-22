(async () => {
  try {
    const fetch = globalThis.fetch;
    const API = process.env.API_BASE || 'http://localhost:5000/api';
    const loginRes = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL || 'admin@esnex.com', password: process.env.ADMIN_PASSWORD || 'Admin1234' }),
    });
    const loginJson = await loginRes.json();
    if (!loginJson.token) {
      console.error('Login failed', loginJson);
      process.exit(2);
    }
    const token = loginJson.token;
    const sectionId = process.argv[2] || '6a3b427960b8fe7674d5486f';
    const objectives = [
      'Understand the project goals',
      'Learn how to use objectives in sections',
      'Verify frontend renders objectives',
    ];
    const res = await fetch(`${API}/sections/${sectionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ objectives }),
    });
    const json = await res.json();
    console.log('Update status', res.status, json);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
