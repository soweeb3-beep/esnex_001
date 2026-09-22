const jwt = require('jsonwebtoken');

// Create a test admin token
const JWT_SECRET = process.env.JWT_SECRET || 'esnex_default_jwt_secret';

const adminUser = {
  _id: 'test-admin-id',
  email: 'admin@test.com',
  role: 'admin'
};

const token = jwt.sign(adminUser, JWT_SECRET);

console.log('Test Admin Token:');
console.log(token);
console.log('\nUse this in Authorization header as: Bearer ' + token);
