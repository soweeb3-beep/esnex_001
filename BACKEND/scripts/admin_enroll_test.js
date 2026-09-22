const https = require('https');
const fetch = (url, opts) => {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  return new Promise((resolve, reject) => {
    const data = opts && opts.body ? Buffer.from(opts.body) : null;
    const req = (isHttps ? require('https') : require('http')).request(url, { method: opts?.method || 'GET', headers: opts?.headers || {} }, res => {
      let body = [];
      res.on('data', c => body.push(c));
      res.on('end', () => {
        const text = Buffer.concat(body).toString();
        resolve({ status: res.statusCode, json: async () => JSON.parse(text), text: async () => text });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@esnex.com', password: 'Admin1234' }),
  });
  const login = await loginRes.json();
  const token = login.token;
  if (!token) return console.error('Login failed', login);

  const resp = await fetch('http://localhost:5000/api/auth/users/6a14599e48d9114de54e63b0/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productType: 'assessment', productId: 'vwwo5yfu1' }),
  });
  const body = await resp.json();
  console.log('STATUS', resp.status);
  console.log(JSON.stringify(body, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
