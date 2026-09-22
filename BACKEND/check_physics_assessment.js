const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection;
db.once('open', async () => {
  try {
    const assessmentModule = require('./models/Assessment');
    const Assessment = assessmentModule.Assessment || assessmentModule;
    
    const physics = await Assessment.findOne({ subject: 'physics' });
    if (!physics) {
      console.log('Physics assessment not found');
      process.exit(0);
    }
    
    console.log('Physics Assessment Data:');
    console.log(JSON.stringify({
      _id: physics._id,
      name: physics.name,
      subject: physics.subject,
      price: physics.price,
      parts: physics.parts?.map(p => ({
        title: p.title,
        partType: p.partType,
        type: p.type,
        totalQuestions: p.totalQuestions,
        sectionsCount: p.sections?.length,
        sections: p.sections?.map(s => ({
          name: s.name,
          questionCount: s.questionCount,
        }))
      }))
    }, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
});
