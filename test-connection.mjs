import mongoose from 'mongoose';

async function testConnection() {
  try {
    console.log('Attempting to connect to: mongodb://127.0.0.1:27017/ev_charging\n');
    
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging', {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      family: 4 // Force IPv4
    });
    
    console.log('✅ Connected to MongoDB successfully!\n');
    console.log(`Database: ${conn.connection.name}`);
    console.log(`Host: ${conn.connection.host}`);
    console.log(`Collections: ${Object.keys(conn.connection.collections)}\n`);

    // Try to list users collection count
    const db = conn.connection.db;
    const userCount = await db.collection('users').countDocuments();
    console.log(`📊 Users in collection: ${userCount}\n`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Connection Error:', err.message);
    console.error('Make sure MongoDB is running on localhost:27017');
  }
}

testConnection();
