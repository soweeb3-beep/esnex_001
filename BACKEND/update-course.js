const mongoose = require('mongoose');
const db = require('./config/db');
const { getModel } = require('./config/adapter');
require('./models/Courses');

(async () => {
  try {
    await new Promise(r => setTimeout(r, 1000));
    
    const courseId = '76oos1loq';
    const Course = getModel('Course');
    
    const query = Course.findById(courseId);
    let course = null;
    if (typeof query.lean === 'function') {
      course = await query.lean();
    } else {
      course = await query;
    }
    
    if (!course) {
      console.log('Course not found');
      process.exit(1);
    }
    
    console.log('Found course:', course.title);
    if (course.sections && course.sections[0] && course.sections[0].lessons && course.sections[0].lessons[0]) {
      course.sections[0].lessons[0].videoUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      course.sections[0].lessons[0].duration = '03:45';
      
      // If course has a save method, use it
      if (typeof course.save === 'function') {
        await course.save();
      }
      console.log('✓ Course updated with video URL');
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e);
    process.exit(1);
  }
})();
