const http = require('http');

// First test: test the public endpoint
const options1 = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/courses',
  method: 'GET'
};

const req1 = http.request(options1, (res) => {
  console.log(`\n=== PUBLIC ENDPOINT /api/courses ===`);
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const obj = JSON.parse(data);
    console.log(`Courses count: ${obj.courses ? obj.courses.length : 0}`);
    
    // Now test protected endpoint
    const options2 = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/courses/76oos1loq/content',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFscGhhX3VzZXJfMDAxIiwicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3ODI0MDQwOTAsImV4cCI6MTc4MzAwODg5MH0.sTHzk5-Zg1IGpvBC6Q690XeEH95y7rOU1zUMJLP74xk'
      }
    };
    
    const req2 = http.request(options2, (res2) => {
      console.log(`\n=== PROTECTED ENDPOINT /api/courses/:id/content ===`);
      console.log(`Status: ${res2.statusCode}`);
      let data2 = '';
      res2.on('data', (chunk) => {
        data2 += chunk;
      });
      res2.on('end', () => {
        console.log('Response:', data2);
        process.exit(0);
      });
    });
    
    req2.on('error', (e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    
    req2.end();
  });
});

req1.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req1.end();
