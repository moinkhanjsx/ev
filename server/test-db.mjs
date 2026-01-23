import ChargingRequest from './src/models/ChargingRequest.js';
import mongoose from 'mongoose';

// Test connection to see if requests exist
mongoose.connect('mongodb://127.0.0.1:27017/ev_charging')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Check if there are any requests in the database
    const allRequests = await ChargingRequest.find({});
    console.log('Total requests in DB:', allRequests.length);
    
    // Check for OPEN requests
    const openRequests = await ChargingRequest.find({ status: 'OPEN' });
    console.log('OPEN requests in DB:', openRequests.length);
    
    if (openRequests.length > 0) {
      openRequests.forEach((req, index) => {
        console.log(`OPEN Request ${index + 1}:`, {
          id: req._id,
          city: req.city,
          status: req.status,
          location: req.location
        });
      });
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
