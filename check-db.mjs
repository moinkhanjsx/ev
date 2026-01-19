import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './server/src/models/User.js';

dotenv.config({ path: './server/.env' });

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB\n');

    const users = await User.find({}, 'name email city tokenBalance createdAt').lean();
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

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkUsers();
