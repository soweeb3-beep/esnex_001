const mongoose = require("mongoose");
const mockDb = require("./mockDb");

let isMongoConnected = false;

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/esnex_learning";
    
    // Set connection timeout of 10 seconds
    const connectionPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    
    // Add a race condition to timeout after 10 seconds
    await Promise.race([
      connectionPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("MongoDB connection timeout")), 10000)
      )
    ]);
    
    console.log("✅ MongoDB Connected to database: esnex_learning");
    isMongoConnected = true;
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    console.warn("⚠️  Falling back to mock database (file-based storage)");
    console.warn("📝 Data will be stored in BACKEND/data/ directory");
    isMongoConnected = false;
    // Don't exit - use mock database instead
  }
};

module.exports = connectDB;
module.exports.isMongoConnected = () => isMongoConnected;
module.exports.mockDb = mockDb;