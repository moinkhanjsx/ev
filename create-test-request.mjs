import mongoose from 'mongoose';

async function createTestRequest() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get Test User from Mumbai
    const user = await db.collection('users').findOne({ city: 'Mumbai' });
    if (!user) {
      console.log('❌ No user found in Mumbai');
      return;
    }
    
    console.log(`Creating test request for user: ${user.name} (${user._id})`);
    
    // Create a valid test request
    const testRequest = {
      requesterId: user._id,
      city: user.city,
      status: "OPEN",
      location: "Andheri Station, Mumbai",
      urgency: "medium",
      message: "Need emergency charging for my electric scooter",
      phoneNumber: "9876543210",
      estimatedTime: 30,
      tokenCost: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('chargingrequests').insertOne(testRequest);
    console.log(`✅ Created test request: ${result.insertedId}`);
    
    // Verify it was created
    const verifyRequest = await db.collection('chargingrequests')
      .findOne({ _id: result.insertedId });
    
    console.log(`\n📋 Verification:`);
    console.log(`   Request ID: ${verifyRequest._id}`);
    console.log(`   Requester: ${verifyRequest.requesterId}`);
    console.log(`   Status: ${verifyRequest.status}`);
    console.log(`   Location: ${verifyRequest.location}`);
    console.log(`   City: ${verifyRequest.city}`);
    
    // Test API query for this user
    const userRequests = await db.collection('chargingrequests')
      .find({ requesterId: user._id })
      .toArray();
    
    console.log(`\n📊 User's requests count: ${userRequests.length}`);
    userRequests.forEach((req, idx) => {
      console.log(`   ${idx + 1}. ${req._id} - ${req.status} - ${req.location}`);
    });
    
    await mongoose.disconnect();
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestRequest();
