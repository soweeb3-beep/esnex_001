const mongoose = require('mongoose');
const { Assessment } = require('./models/Assessment');
const dotenv = require('dotenv');

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

const subjects = [
  'physics', 'chemistry', 'biology', 'integrated science',
  'literature in english', 'history', 'geography', 'government',
  'islamic religious studies', 'christian religious studies',
  'arabic', 'french', 'principles of accounts', 'economics',
  'commerce', 'financial accounting', 'business management', 'arts'
];

(async () => {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    for (const subject of subjects) {
      try {
        // Check if exists
        const exists = await Assessment.findOne({ subject, type: 'global' });
        if (exists) {
          console.log(`✓ ${subject}: Already exists`);
          continue;
        }

        // Create
        const assessment = await Assessment.create({
          name: subject.charAt(0).toUpperCase() + subject.slice(1) + ' Global Assessment',
          description: `${subject} subject assessment`,
          type: 'global',
          subject: subject,
          price: 10,
          subscription: 'monthly',
          status: 'published',
          duration: 120,
          totalMarks: 100,
          parts: [],
          visibility: true
        });

        console.log(`✓ ${subject}: Created ${assessment._id}`);
      } catch (e) {
        console.error(`✗ ${subject}:`, e.message);
      }
    }

    console.log('\n✓ Complete');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();