const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

db.once('open', async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Get the Assessment model
    const assessmentModule = require('./models/Assessment');
    const Assessment = assessmentModule.Assessment || assessmentModule;
    
    // Find physics assessment
    const physics = await Assessment.findOne({ subject: 'physics' });
    if (!physics) {
      console.log('Physics assessment not found');
      process.exit(0);
    }
    
    console.log('Current physics assessment:', {
      _id: physics._id,
      name: physics.name,
      price: physics.price,
      subject: physics.subject,
    });
    
    // Update price to 0
    physics.price = 0;
    await physics.save();
    
    console.log('✅ Physics assessment price updated to 0');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
});
