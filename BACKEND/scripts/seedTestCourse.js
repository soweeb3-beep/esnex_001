const connectDB = require('../config/db');
const { getModel } = require('../config/adapter');

const run = async () => {
  try {
    await connectDB();
    const Course = getModel('Course');

    const title = 'Seed Test Course - Objectives Demo';

    const sample = {
      title,
      description: 'A small test course created by seed script to verify objectives persistence and rendering.',
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
            'Learn how to use objectives in sections',
            'Verify frontend renders objectives',
          ],
          lessons: [
            { title: 'Welcome', videoUrl: '', duration: '00:05', order: 1 },
          ],
        },
      ],
    };

    let existing = null;
    if (typeof Course.findOne === 'function') {
      existing = await Course.findOne({ title });
    } else if (typeof Course.find === 'function') {
      const all = await Course.find().exec?.() ?? await Course.find();
      existing = Array.isArray(all) ? all.find((c) => c.title === title) : (all && all.title === title ? all : null);
    }

    if (existing) {
      existing.description = sample.description;
      existing.sections = sample.sections;
      await existing.save?.() ?? Promise.resolve();
      console.log('Updated existing seed course.');
      process.exit(0);
    }

    const created = await Course.create(sample);
    console.log('Created seed course with id:', (created._id || created._id)?.toString ? created._id.toString() : created._id);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

run();
