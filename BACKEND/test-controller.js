// Test courseController directly
const path = require('path');
process.env.NODE_ENV = 'test';

// Manually set up mock mode
const adapter = require('./config/adapter');
const { getCourseContent } = require('./controllers/courseController');

// Create mock req and res
const req = {
  params: { id: '76oos1loq' },
  user: { id: 'alpha_user_001', _id: 'alpha_user_001' }
};

const res = {
  statusCode: 200,
  jsonData: null,
  json: function(data) {
    this.jsonData = data;
    console.log('Response JSON:', JSON.stringify(data, null, 2));
  },
  status: function(code) {
    this.statusCode = code;
    return this;
  }
};

console.log('=== Testing getCourseContent directly ===');
getCourseContent(req, res).then(() => {
  console.log('Final status:', res.statusCode);
}).catch((err) => {
  console.error('Error:', err);
});
