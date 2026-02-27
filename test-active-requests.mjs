import mongoose from 'mongoose';

const DEFAULT_CITY = 'Mumbai';

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

async function testActiveRequests() {
  let connected = false;
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    connected = true;
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const city = process.env.TEST_CITY || process.argv[2] || DEFAULT_CITY;

    // Get the test user for the selected city
    const user = await db.collection('users').findOne({ city });
    if (!user) {
      console.log(`❌ No user found in city: ${city}`);
      return;
    }

    console.log(`Testing Active Requests for user: ${user.name} (${user._id})`);
    console.log(`User city: ${user.city}`);

    // Test the exact query that ActiveRequests.jsx uses
    const cityFilter = {
      status: 'OPEN',
      city: { $regex: `^${user.city}$`, $options: 'i' },
    };

    console.log(`City filter:`, cityFilter);

    const cityRequests = await db.collection('chargingrequests')
      .find(cityFilter)
      .toArray();

    console.log(`\nFound ${cityRequests.length} OPEN requests in city "${user.city}":`);

    cityRequests.forEach((req, idx) => {
      const requesterId = toIdString(req.requesterId);
      const isMyRequest = requesterId === user._id.toString();

      console.log(`\n${idx + 1}. Request: ${req._id}`);
      console.log(`   RequesterId: ${requesterId}`);
      console.log(`   Is my request: ${isMyRequest}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Location: ${req.location}`);
      console.log(`   City: ${req.city}`);
      console.log(`   Should show in Active Requests: ${!isMyRequest && req.status === 'OPEN'}`);
    });

    // Simulate the filtering logic from ActiveRequests.jsx
    const otherUsersRequests = cityRequests.filter((request) => {
      const requesterId = toIdString(request.requesterId);
      const myUserId = user._id.toString();
      const isMyRequest = requesterId === myUserId;
      return !isMyRequest; // Exclude my own requests
    });

    console.log(`\n📊 FILTERED RESULT:`);
    console.log(`Total OPEN requests in ${user.city}: ${cityRequests.length}`);
    console.log(`Requests from other users: ${otherUsersRequests.length}`);
    console.log(`Requests that should appear in Active Requests page: ${otherUsersRequests.length}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connected) {
      await mongoose.disconnect();
    }
  }
}

testActiveRequests();
