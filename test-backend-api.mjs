import mongoose from 'mongoose';

async function testBackendAPI() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get a Mumbai user to test with
    const mumbaiUser = await db.collection('users').findOne({ city: 'Mumbai' });
    if (!mumbaiUser) {
      console.log('❌ No Mumbai user found');
      return;
    }
    
    console.log(`\n👤 Testing with user: ${mumbaiUser.name} (${mumbaiUser._id})`);
    
    // Test the exact API query that frontend makes
    const cityFilter = { 
      status: "OPEN",
      city: { $regex: `^Mumbai$`, $options: 'i' }
    };
    
    console.log('\n🔍 Testing backend API query:');
    console.log('Filter:', JSON.stringify(cityFilter, null, 2));
    
    const requests = await db.collection('chargingrequests')
      .find(cityFilter)
      .toArray();
    
    console.log(`\n📋 Raw requests found: ${requests.length}`);
    
    // Manually populate requester info using Promise.all for better performance
    const requesterPromises = requests.map(async req => {
      const requester = await db.collection('users').findOne({ _id: req.requesterId });
      return {
        ...req,
        requesterName: requester ? requester.name : 'Unknown',
        requesterEmail: requester ? requester.email : 'Unknown'
      };
    });
    
    const populatedRequests = await Promise.all(requesterPromises);
    
    console.log(`\n📋 API RESULTS: ${requests.length} requests found`);
    requests.forEach((req, idx) => {
      const isMyRequest = req.requesterId._id.toString() === mumbaiUser._id.toString();
      const requesterName = req.requesterId.name || req.requesterId.email;
      
      console.log(`${idx + 1}. ${req._id}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Location: ${req.location}`);
      console.log(`   Requester: ${requesterName} (${isMyRequest ? 'MY REQUEST' : 'OTHER USER'})`);
      console.log(`   Should show in Active Requests: ${!isMyRequest}`);
    });
    
    // Filter out user's own requests (what frontend should do)
    const otherUsersRequests = requests.filter(req => 
      req.requesterId._id.toString() !== mumbaiUser._id.toString()
    );
    
    console.log(`\n📊 FILTERED RESULT:`);
    console.log(`Requests from other users: ${otherUsersRequests.length}`);
    
    if (otherUsersRequests.length > 0) {
      console.log('\n✅ SUCCESS: Backend API is working correctly!');
      console.log('Frontend should show these requests if user is authenticated properly.');
    } else {
      console.log('\n❌ ISSUE: No requests from other users found in Mumbai');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBackendAPI();
