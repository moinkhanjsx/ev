import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

async function testAPIEndpoint() {
  try {
    // Connect to database
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get a real user from database
    const user = await db.collection('users').findOne({});
    if (!user) {
      console.log('❌ No users found in database');
      return;
    }
    
    console.log(`Testing with user: ${user.name} (${user._id})`);
    console.log(`User city: ${user.city}`);
    
    // Create a JWT token for this user (same as server does)
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    console.log(`Generated token: ${token.substring(0, 50)}...`);
    
    // Test the database query that the API uses
    const filter = { requesterId: user._id };
    console.log(`Query filter:`, filter);
    
    const requests = await db.collection('chargingrequests')
      .find(filter)
      .toArray();
    
    console.log(`Found ${requests.length} requests for this user:`);
    requests.forEach((req, idx) => {
      console.log(`  ${idx + 1}. ID: ${req._id}, Status: ${req.status}, Location: ${req.location}`);
    });
    
    // Also test city-based query
    const cityFilter = { 
      status: "OPEN",
      city: { $regex: `^${user.city}$`, $options: 'i' }
    };
    
    const cityRequests = await db.collection('chargingrequests')
      .find(cityFilter)
      .toArray();
    
    console.log(`\nFound ${cityRequests.length} OPEN requests in city "${user.city}":`);
    cityRequests.forEach((req, idx) => {
      console.log(`  ${idx + 1}. ID: ${req._id}, Status: ${req.status}, Location: ${req.location}`);
    });
    
    await mongoose.disconnect();
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPIEndpoint();
