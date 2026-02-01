import mongoose from 'mongoose';

async function testDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Check collections
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Check users
    const userCount = await db.collection('users').countDocuments();
    console.log(`Users: ${userCount}`);
    
    // Check charging requests
    const requestCount = await db.collection('chargingrequests').countDocuments();
    console.log(`Charging Requests: ${requestCount}`);
    
    if (requestCount > 0) {
      const requests = await db.collection('chargingrequests').find({}).limit(3).toArray();
      console.log('Sample requests:', requests.map(r => ({
        id: r._id,
        requesterId: r.requesterId,
        city: r.city,
        status: r.status,
        location: r.location
      })));
    }
    
    await mongoose.disconnect();
    console.log('✅ Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDB();
