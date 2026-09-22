const axios = require('axios');
const BASE_URL = 'http://localhost:5000/api';

const subjects = [
  'physics', 'chemistry', 'biology', 'integrated science', 
  'literature in english', 'history', 'geography', 'government', 
  'islamic religious studies', 'christian religious studies', 
  'arabic', 'french', 'principles of accounts', 'economics', 
  'commerce', 'financial accounting', 'business management', 'arts'
];

async function createAssessments() {
  try {
    console.log('Getting admin token...');
    const admin = await axios.post(BASE_URL + '/auth/login', {
      email: 'admin@esnex.com',
      password: 'Admin123'
    });
    
    const token = admin.data.token;
    console.log('✓ Admin logged in\n');
    
    for (const subject of subjects) {
      try {
        console.log(`Creating: ${subject}...`);
        const res = await axios.post(BASE_URL + '/assessments', {
          name: subject.charAt(0).toUpperCase() + subject.slice(1) + ' Global Assessment',
          description: subject + ' subject assessment',
          type: 'global',
          subject: subject,
          price: 10,
          subscription: 'monthly',
          status: 'published',
          duration: 120,
          totalMarks: 100,
          parts: []
        }, {
          headers: { Authorization: 'Bearer ' + token }
        });
        console.log(`✓ ${subject}: ${res.data.assessment._id}`);
      } catch (e) {
        if (e.response?.data?.message?.includes('Subject already has an existing global assessment')) {
          console.log(`⚠ ${subject}: Already exists`);
        } else {
          console.error(`✗ ${subject}:`, e.response?.data?.message || e.message);
        }
      }
    }
    
    console.log('\n✓ Assessment creation complete');
  } catch (e) {
    console.error('✗ Login failed:', e.response?.data?.message || e.message);
  }
}

createAssessments();