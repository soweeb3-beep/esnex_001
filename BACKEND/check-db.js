const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

console.log('\n=== MOCK DATABASE CONTENTS ===\n');

// Check enrollments
const enrollmentsFile = path.join(dataDir, 'enrollments.json');
if (fs.existsSync(enrollmentsFile)) {
  const enrollments = JSON.parse(fs.readFileSync(enrollmentsFile, 'utf8'));
  console.log('📋 ENROLLMENTS:', JSON.stringify(enrollments, null, 2));
} else {
  console.log('❌ Enrollments file not found');
}

// Check payments
const paymentsFile = path.join(dataDir, 'payments.json');
if (fs.existsSync(paymentsFile)) {
  const payments = JSON.parse(fs.readFileSync(paymentsFile, 'utf8'));
  console.log('\n💰 PAYMENTS:', JSON.stringify(payments, null, 2));
} else {
  console.log('❌ Payments file not found');
}

// Check courses
const coursesFile = path.join(dataDir, 'courses.json');
if (fs.existsSync(coursesFile)) {
  const courses = JSON.parse(fs.readFileSync(coursesFile, 'utf8'));
  console.log('\n📚 COURSES:', courses.map(c => ({ _id: c._id, title: c.title, price: c.price })));
} else {
  console.log('❌ Courses file not found');
}

// Check users
const usersFile = path.join(dataDir, 'users.json');
if (fs.existsSync(usersFile)) {
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  console.log('\n👥 USERS:', users.map(u => ({ _id: u._id, email: u.email, role: u.role })));
} else {
  console.log('❌ Users file not found');
}

console.log('\n=== END ===\n');
