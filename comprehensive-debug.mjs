import mongoose from 'mongoose';

async function comprehensiveDebug() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Test 1: Check all users and their cities
    const users = await db.collection('users').find({}).toArray();
    console.log(`\n📊 ALL USERS (${users.length}):`);
    users.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name} - ${user.city} (ID: ${user._id})`);
    });
    
    // Test 2: Check OPEN requests by city
    const openRequests = await db.collection('chargingrequests')
      .find({ status: 'OPEN' })
      .toArray();
    
    console.log(`\n📋 ALL OPEN REQUESTS (${openRequests.length}):`);
    const requestsByCity = {};
    openRequests.forEach(req => {
      if (!requestsByCity[req.city]) {
        requestsByCity[req.city] = [];
      }
      requestsByCity[req.city].push(req);
    });
    
    Object.entries(requestsByCity).forEach(([city, requests]) => {
      console.log(`   ${city}: ${requests.length} requests`);
      requests.forEach((req, idx) => {
        const requester = users.find(u => u._id.toString() === req.requesterId.toString());
        console.log(`     ${idx + 1}. ${req._id} - ${req.location} - by ${requester?.name || 'Unknown'}`);
      });
    });
    
    // Test 3: Simulate what frontend should see for Mumbai users
    const mumbaiUsers = users.filter(u => u.city.toLowerCase() === 'mumbai');
    console.log(`\n👥 MUMBAI USERS (${mumbaiUsers.length}):`);
    
    mumbaiUsers.forEach(user => {
      const mumbaiOpenRequests = openRequests.filter(req => 
        req.city.toLowerCase() === 'mumbai' && 
        req.requesterId.toString() !== user._id.toString()
      );
      
      console.log(`\nUser: ${user.name} (${user._id})`);
      console.log(`Should see ${mumbaiOpenRequests.length} OPEN requests from other users`);
      
      mumbaiOpenRequests.forEach((req, idx) => {
        const requester = users.find(u => u._id.toString() === req.requesterId.toString());
        const isMyRequest = req.requesterId.toString() === user._id.toString();
        console.log(`  ${idx + 1}. ${req._id} - ${isMyRequest ? 'MY REQUEST' : 'OTHER USER'} - ${requester?.name || 'Unknown'}`);
      });
    });
    
    // Test 4: Check backend API response format
    console.log(`\n🔍 BACKEND API TEST:`);
    console.log('Expected API call: GET /api/charging/requests/city/mumbai');
    console.log('Expected filter: { status: "OPEN", city: { $regex: "^mumbai$", $options: "i" }');
    
    await mongoose.disconnect();
    console.log('\n✅ Debug analysis complete');
    console.log('\n📋 SUMMARY:');
    console.log('1. Database has users and requests');
    console.log('2. OPEN requests exist in multiple cities');
    console.log('3. Mumbai users should see requests from other Mumbai users');
    console.log('4. Check browser console for debugging output from frontend');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

comprehensiveDebug();
