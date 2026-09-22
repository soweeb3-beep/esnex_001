const fetch = globalThis.fetch || require('node-fetch');

const url = process.env.URL || 'http://localhost:5000/api/courses';
let attempts = 0;
const maxAttempts = 12;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data.courses) && data.courses.length > 0) {
        console.log('API is up and returned courses. Sample:', data.courses[0].title);
        process.exit(0);
      }
      if (Array.isArray(data)) {
        console.log('API returned array:', data.length);
        process.exit(0);
      }
      console.log('Attempt', attempts, 'no courses yet, status', res.status);
    } catch (err) {
      console.log('Attempt', attempts, 'error connecting:', err.message);
    }
    await wait(2000);
  }
  console.error('API did not return courses after', maxAttempts, 'attempts');
  process.exit(2);
})();
