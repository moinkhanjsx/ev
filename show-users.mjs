import mongoose from 'mongoose';

async function showUsers() {
  try {
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging', {
      serverSelectionTimeoutMS: 5000,
      family: 4
    });
    
    const db = conn.connection.db;
    const users = await db.collection('users')
      .find({}, { projection: { name: 1, email: 1, city: 1, tokenBalance: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray();

    console.log('\n📊 USERS IN DATABASE\n');
    console.log(`Total: ${users.length} users\n`);
    console.log('━'.repeat(80));

    users.forEach((user, idx) => {
      const date = new Date(user.createdAt).toLocaleString();
      console.log(`\n${idx + 1}. ${user.name}`);
      console.log(`   Email:  ${user.email}`);
      console.log(`   City:   ${user.city}`);
      console.log(`   Tokens: ${user.tokenBalance}`);
      console.log(`   Created: ${date}`);
    });

    console.log('\n' + '━'.repeat(80) + '\n');

    // Show summary by city
    const cities = await db.collection('users')
      .aggregate([
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .toArray();

    console.log('📍 USERS BY CITY:\n');
    cities.forEach(c => {
      console.log(`   ${c._id}: ${c.count} user(s)`);
    });

    console.log('\n');
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

showUsers();
