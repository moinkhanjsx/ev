import mongoose from 'mongoose';

async function checkRequests() {
  try {
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging', {
      serverSelectionTimeoutMS: 5000,
      family: 4
    });
    
    const db = conn.connection.db;
    const requests = await db.collection('chargingrequests')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    console.log('\n📊 CHARGING REQUESTS IN DATABASE\n');
    console.log(`Total: ${requests.length} requests\n`);
    console.log('━'.repeat(100));

    if (requests.length === 0) {
      console.log('❌ No charging requests found in the database.');
    } else {
      requests.forEach((request, idx) => {
        const date = new Date(request.createdAt).toLocaleString();
        console.log(`\n${idx + 1}. Request ID: ${request._id}`);
        console.log(`   Requester: ${request.requesterId}`);
        console.log(`   City:      ${request.city}`);
        console.log(`   Status:    ${request.status}`);
        console.log(`   Location:  ${request.location}`);
        console.log(`   Urgency:   ${request.urgency}`);
        console.log(`   Phone:     ${request.phoneNumber}`);
        console.log(`   Tokens:    ${request.tokenCost}`);
        console.log(`   Created:   ${date}`);
        if (request.helperId) {
          console.log(`   Helper:    ${request.helperId}`);
        }
      });
    }

    console.log('\n' + '━'.repeat(100) + '\n');

    // Show summary by status
    const statusSummary = await db.collection('chargingrequests')
      .aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .toArray();

    console.log('📈 REQUESTS BY STATUS:\n');
    statusSummary.forEach(s => {
      console.log(`   ${s._id}: ${s.count} request(s)`);
    });

    // Show summary by city
    const citySummary = await db.collection('chargingrequests')
      .aggregate([
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .toArray();

    console.log('\n📍 REQUESTS BY CITY:\n');
    citySummary.forEach(c => {
      console.log(`   ${c._id}: ${c.count} request(s)`);
    });

    console.log('\n');
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkRequests();
