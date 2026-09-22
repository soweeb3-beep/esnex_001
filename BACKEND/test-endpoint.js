const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/courses/76oos1loq/content',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFscGhhX3VzZXJfMDAxIiwicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3ODI0MDQwOTAsImV4cCI6MTc4MzAwODg5MH0.sTHzk5-Zg1IGpvBC6Q690XeEH95y7rOU1zUMJLP74xk'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req.end();
