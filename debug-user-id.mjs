import mongoose from 'mongoose';

async function debugUserId() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get all users to see their IDs
    const users = await db.collection('users').find({}).toArray();
    console.log(`\n📊 All Users in Database:`);
    users.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name}`);
      console.log(`   _id: ${user._id} (type: ${typeof user._id})`);
      console.log(`   _id.toString(): ${user._id.toString()}`);
      console.log(`   city: ${user.city}`);
    });
    
    // Get all requests in Mumbai to see what requesterIds they have
    const mumbaiRequests = await db.collection('chargingrequests')
      .find({ city: 'Mumbai', status: 'OPEN' })
      .toArray();
    
    console.log(`\n📋 OPEN Requests in Mumbai:`);
    mumbaiRequests.forEach((req, idx) => {
      console.log(`${idx + 1}. Request: ${req._id}`);
      console.log(`   requesterId: ${req.requesterId} (type: ${typeof req.requesterId})`);
      if (typeof req.requesterId === 'object') {
        console.log(`   requesterId.toString(): ${req.requesterId.toString()}`);
      }
      console.log(`   city: ${req.city}`);
      console.log(`   status: ${req.status}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugUserId();
