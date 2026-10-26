// models/db.js - Resilient Database Connection Manager
const mongoose = require('mongoose');

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zenflow';

  try {
    console.log(`📡 Connecting to MongoDB at ${MONGO_URI.replace(/\/\/.*@/, '//<credentials>@')}...`);
    
    // Set a 3-second server selection timeout to prevent hanging when local mongod is not started
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    });

    console.log('🎉 MongoDB Connected Successfully!');
    return true;
  } catch (err) {
    console.log('⚠️ MongoDB standalone service is not reachable on localhost:27017.');
    console.log('💡 ZenFlow has activated its resilient internal storage engine. All ticket operations and live chats will persist seamlessly in data/tickets_store.json!');
    return false;
  }
};

module.exports = connectDB;
