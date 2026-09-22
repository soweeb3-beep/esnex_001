const fetch = globalThis.fetch || require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@esnex.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234';

const payload = {
  title: 'Seed Test Course - Objectives Demo (API)',
  description: 'Seeded via API to ensure it appears in the running server responses.',
  category: 'IT',
  subject: 'Testing',
  status: 'published',
  price: 0,
  instructor: { name: 'Seed Admin' },
  sections: [
    {
      title: 'Introduction',
      description: 'Intro section',
      order: 1,
      objectives: [
        'Understand the project goals',
        "Learn how to use objectives in sections",
        'Verify frontend renders objectives',
      ],
      lessons: [
        { title: 'Welcome', videoUrl: '', duration: '00:05', order: 1 },
      ],
    },
  ],
};

(async () => {
  try {
    console.log('Logging in as admin:', ADMIN_EMAIL);
    const res1 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const json1 = await res1.json();
    if (!json1.token) {
      console.error('Login failed:', JSON.stringify(json1));
      process.exit(2);
    }
    const token = json1.token;
    console.log('Logged in, token length:', token.length);

    // Check if course exists already
    const listRes = await fetch(`${API_BASE}/courses`);
    const listJson = await listRes.json();
    const found = (listJson.courses || []).find((c) => c.title && c.title.startsWith('Seed Test Course - Objectives Demo'));
    if (found) {
      console.log('Course already exists; updating via PUT');
      const updateRes = await fetch(`${API_BASE}/courses/${found._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const upJson = await updateRes.json();
      console.log('Update response:', upJson.message || updateRes.status);
      process.exit(0);
    }

    const createRes = await fetch(`${API_BASE}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const createJson = await createRes.json();
    console.log('Create response:', createJson.message || createRes.status, createJson.course?._id);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding via API:', err);
    process.exit(1);
  }
})();
