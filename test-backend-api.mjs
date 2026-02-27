import mongoose from 'mongoose';

const DEFAULT_CITY = 'Mumbai';

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

async function testBackendAPI() {
  let connected = false;
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    connected = true;
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const city = process.env.TEST_CITY || process.argv[2] || DEFAULT_CITY;

    const user = await db.collection('users').findOne({ city });
    if (!user) {
      console.log(`❌ No user found in city: ${city}`);
      return;
    }

    console.log(`\n👤 Testing with user: ${user.name} (${user._id})`);

    // Test the exact API query that frontend makes
    const cityFilter = {
      status: 'OPEN',
      city: { $regex: `^${city}$`, $options: 'i' },
    };

    console.log('\n🔍 Testing backend API query:');
    console.log('Filter:', JSON.stringify(cityFilter, null, 2));

    const requests = await db.collection('chargingrequests')
      .find(cityFilter)
      .toArray();

    console.log(`\n📋 Raw requests found: ${requests.length}`);

    // Manually populate requester info using Promise.all for better performance
    const populatedRequests = await Promise.all(
      requests.map(async (req) => {
        const requesterId = toIdString(req.requesterId);
        const requester = requesterId
          ? await db.collection('users').findOne({ _id: req.requesterId })
          : null;
        return {
          ...req,
          requesterName: requester ? requester.name : 'Unknown',
          requesterEmail: requester ? requester.email : 'Unknown',
        };
      })
    );

    console.log(`\n📋 API RESULTS: ${requests.length} requests found`);
    populatedRequests.forEach((req, idx) => {
      const requesterId = toIdString(req.requesterId);
      const isMyRequest = requesterId === user._id.toString();

      console.log(`${idx + 1}. ${req._id}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Location: ${req.location}`);
      console.log(
        `   Requester: ${req.requesterName} (${isMyRequest ? 'MY REQUEST' : 'OTHER USER'})`
      );
      console.log(`   Should show in Active Requests: ${!isMyRequest}`);
    });

    // Filter out user's own requests (what frontend should do)
    const otherUsersRequests = populatedRequests.filter(
      (req) => toIdString(req.requesterId) !== user._id.toString()
    );

    console.log(`\n📊 FILTERED RESULT:`);
    console.log(`Requests from other users: ${otherUsersRequests.length}`);

    if (otherUsersRequests.length > 0) {
      console.log('\n✅ SUCCESS: Backend API is working correctly!');
      console.log('Frontend should show these requests if user is authenticated properly.');
    } else {
      console.log(`\n❌ ISSUE: No requests from other users found in ${city}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connected) {
      await mongoose.disconnect();
    }
  }
}

testBackendAPI();
