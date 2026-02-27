import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

async function checkUsers() {
  let connected = false;
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ev_charging';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const users = await db.collection('users')
      .find({}, { projection: { name: 1, email: 1, city: 1, tokenBalance: 1, createdAt: 1 } })
      .toArray();

    console.log(`📊 Total Users: ${users.length}\n`);

    if (users.length > 0) {
      console.log('📋 Users in Database:\n');
      users.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   City: ${user.city}`);
        console.log(`   Tokens: ${user.tokenBalance}`);
        console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}\n`);
      });
    } else {
      console.log('ℹ️  No users found in database yet.\n');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    if (connected) {
      await mongoose.disconnect();
    }
  }
}

checkUsers();
