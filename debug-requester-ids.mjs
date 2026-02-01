import mongoose from 'mongoose';

async function debugRequesterIds() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get all users to compare
    const users = await db.collection('users').find({}).toArray();
    console.log(`\n📊 Users in database (${users.length}):`);
    users.forEach(user => {
      console.log(`  ${user._id} - ${user.name} (${user.city})`);
    });
    
    // Get all requests with requesterId analysis
    const requests = await db.collection('chargingrequests').find({}).toArray();
    console.log(`\n📋 Charging Requests (${requests.length}):`);
    
    let malformedCount = 0;
    let validCount = 0;
    
    requests.forEach((req, idx) => {
      const requesterId = req.requesterId;
      const isValidObjectId = mongoose.Types.ObjectId.isValid(requesterId);
      const isString = typeof requesterId === 'string';
      const hasValidUser = users.some(user => user._id.toString() === requesterId.toString());
      
      console.log(`\n${idx + 1}. Request: ${req._id}`);
      console.log(`   RequesterId: ${requesterId} (${typeof requesterId})`);
      console.log(`   Valid ObjectId: ${isValidObjectId}`);
      console.log(`   Has matching user: ${hasValidUser}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Location: ${req.location}`);
      console.log(`   City: ${req.city}`);
      
      if (isString && !isValidObjectId) {
        malformedCount++;
        console.log(`   ❌ MALFORMED - String instead of ObjectId`);
      } else if (!hasValidUser) {
        malformedCount++;
        console.log(`   ❌ MALFORMED - No matching user found`);
      } else {
        validCount++;
        console.log(`   ✅ VALID`);
      }
    });
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Valid requests: ${validCount}`);
    console.log(`   Malformed requests: ${malformedCount}`);
    console.log(`   Total requests: ${requests.length}`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugRequesterIds();
