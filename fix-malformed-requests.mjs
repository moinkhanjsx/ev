import mongoose from 'mongoose';

async function fixMalformedRequests() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ev_charging');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Find all requests with malformed requesterId
    const malformedRequests = await db.collection('chargingrequests')
      .find({
        requesterId: { $type: 'string' }
      })
      .toArray();
    
    console.log(`Found ${malformedRequests.length} requests with string requesterId:`);
    
    for (const request of malformedRequests) {
      console.log(`\nProcessing request: ${request._id}`);
      console.log(`Current requesterId: ${request.requesterId}`);
      
      if (request.requesterId === 'USER_OBJECT_ID_HERE') {
        // This request is malformed - we should either delete it or fix it
        // Since we don't know the real user, let's delete it
        const result = await db.collection('chargingrequests')
          .deleteOne({ _id: request._id });
        
        console.log(`❌ Deleted malformed request: ${request._id}`);
        console.log(`   Deleted count: ${result.deletedCount}`);
      }
    }
    
    // Verify the fix
    const remainingMalformed = await db.collection('chargingrequests')
      .find({
        requesterId: { $type: 'string' }
      })
      .countDocuments();
    
    console.log(`\n✅ Fix completed! Remaining malformed requests: ${remainingMalformed}`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixMalformedRequests();
