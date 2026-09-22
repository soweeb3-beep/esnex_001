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
    const courseId = process.argv[2] || '6a3b427960b8fe7674d5486e';
    const res = await fetch(`${API}/courses/${courseId}/content`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    console.log(JSON.stringify(json.course.sections.map(s=>({id:s._id,title:s.title,objectives:s.objectives})), null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
