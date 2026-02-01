import mongoose from 'mongoose';

async function debugLoggedUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Find the user that matches the console output ID
    const loggedUserId = '697d96b2c3d5b636b418b0cc';
    const loggedUser = await db.collection('users').findOne({ _id: loggedUserId });
    
    if (!loggedUser) {
      console.log(`❌ No user found with ID: ${loggedUserId}`);
      return;
    }
    
    console.log(`\n👤 LOGGED IN USER:`);
    console.log(`   Name: ${loggedUser.name}`);
    console.log(`   ID: ${loggedUser._id}`);
    console.log(`   City: ${loggedUser.city}`);
    
    // Check what requests exist in their city
    const cityRequests = await db.collection('chargingrequests')
      .find({ 
        status: "OPEN",
        city: { $regex: `^${loggedUser.city}$`, $options: 'i' }
      })
      .toArray();
    
    console.log(`\n📋 OPEN REQUESTS IN ${loggedUser.city}:`);
    console.log(`Total: ${cityRequests.length}`);
    
    cityRequests.forEach((req, idx) => {
      const isMyRequest = req.requesterId.toString() === loggedUser._id.toString();
      console.log(`\n${idx + 1}. Request: ${req._id}`);
      console.log(`   Requester: ${req.requesterId}`);
      console.log(`   Is my request: ${isMyRequest}`);
      console.log(`   Should show in Active Requests: ${!isMyRequest}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Location: ${req.location}`);
    });
    
    // Filter out their own requests
    const otherUsersRequests = cityRequests.filter(req => {
      const isMyRequest = req.requesterId.toString() === loggedUser._id.toString();
      return !isMyRequest;
    });
    
    console.log(`\n📊 FILTERED RESULT:`);
    console.log(`Requests from other users: ${otherUsersRequests.length}`);
    for (const [idx, req] of otherUsersRequests.entries()) {
      const requester = await db.collection('users').findOne({ _id: req.requesterId });
      console.log(`   ${idx + 1}. ${req._id} - ${req.location} - by ${requester.name}`);
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugLoggedUser();
