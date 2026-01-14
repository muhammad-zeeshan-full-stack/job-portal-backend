import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    console.log('🔍 [DEBUG] Attempting to connect to MongoDB...');
    console.log('🔍 [DEBUG] MONGODB_URI:', process.env.MONGODB_URI ? 'Present' : 'Missing');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      w: 'majority'
    });

    console.log(`✅ [DEBUG] MongoDB Connected: ${conn.connection.host}`);
    console.log(`✅ [DEBUG] Database: ${conn.connection.name}`);
    console.log(`✅ [DEBUG] Connection state: ${conn.connection.readyState}`);
    
    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('✅ [DEBUG] Mongoose connected to DB');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ [DEBUG] Mongoose connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ [DEBUG] Mongoose disconnected from DB');
    });
    
    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('⚠️ [DEBUG] MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ [DEBUG] MongoDB connection error details:');
    console.error('❌ [DEBUG] Error message:', error.message);
    console.error('❌ [DEBUG] Error code:', error.code);
    console.error('❌ [DEBUG] Error name:', error.name);
    
    // More specific error messages
    if (error.name === 'MongoParseError') {
      console.error('❌ [DEBUG] MongoDB URI parse error - check your connection string');
    } else if (error.name === 'MongoNetworkError') {
      console.error('❌ [DEBUG] MongoDB network error - check your network connection');
    } else if (error.name === 'MongoServerSelectionError') {
      console.error('❌ [DEBUG] MongoDB server selection error - check your cluster status');
    }
    
    process.exit(1);
  }
};

export default connectDB;