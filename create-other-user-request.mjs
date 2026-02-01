import mongoose from 'mongoose';

async function createOtherUserRequest() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get a user from Bhusawal (not Mumbai)
    const otherUser = await db.collection('users').findOne({ city: 'Bhusawal' });
    if (!otherUser) {
      console.log('❌ No user found in Bhusawal');
      return;
    }
    
    console.log(`Creating test request for other user: ${otherUser.name} (${otherUser._id})`);
    console.log(`But setting their city to Mumbai so Test User can see it`);
    
    // Create a test request from other user in Mumbai
    const testRequest = {
      requesterId: otherUser._id,
      city: 'Mumbai', // Set to Mumbai so Test User can see it
      status: "OPEN",
      location: "Bandra Station, Mumbai",
      urgency: "high",
      message: "Need urgent charging for electric bike",
      phoneNumber: "9876543211",
      estimatedTime: 45,
      tokenCost: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('chargingrequests').insertOne(testRequest);
    console.log(`✅ Created other user's test request: ${result.insertedId}`);
    
    // Verify it was created
    const verifyRequest = await db.collection('chargingrequests')
      .findOne({ _id: result.insertedId });
    
    console.log(`\n📋 Verification:`);
    console.log(`   Request ID: ${verifyRequest._id}`);
    console.log(`   Requester: ${verifyRequest.requesterId} (${otherUser.name})`);
    console.log(`   Status: ${verifyRequest.status}`);
    console.log(`   Location: ${verifyRequest.location}`);
    console.log(`   City: ${verifyRequest.city}`);
    
    // Test what Test User should see in Active Requests
    const testUser = await db.collection('users').findOne({ city: 'Mumbai' });
    const cityFilter = { 
      status: "OPEN",
      city: { $regex: `^Mumbai$`, $options: 'i' }
    };
    
    const mumbaiRequests = await db.collection('chargingrequests')
      .find(cityFilter)
      .toArray();
    
    console.log(`\n📊 What Test User should see in Active Requests:`);
    console.log(`Total OPEN requests in Mumbai: ${mumbaiRequests.length}`);
    
    const otherUsersRequests = mumbaiRequests.filter(request => {
      const isMyRequest = request.requesterId.toString() === testUser._id.toString();
      return !isMyRequest; // Exclude Test User's own request
    });
    
    console.log(`Requests from other users: ${otherUsersRequests.length}`);
    for (const [idx, req] of otherUsersRequests.entries()) {
      const requester = await db.collection('users').findOne({ _id: req.requesterId });
      console.log(`   ${idx + 1}. ${req._id} - ${req.location} - by ${requester.name}`);
    }
    
    await mongoose.disconnect();
    console.log('✅ Test completed - Active Requests should now show 1 request');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createOtherUserRequest();
