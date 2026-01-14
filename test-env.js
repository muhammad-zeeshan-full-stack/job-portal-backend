import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 [DEBUG] Checking environment variables:');
console.log('SMTP_USER:', process.env.SMTP_USER || 'NOT FOUND');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***SET***' : 'NOT FOUND');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '***SET***' : 'NOT FOUND');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '***SET***' : 'NOT FOUND');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// List all environment variables
console.log('\n🔍 [DEBUG] All environment variables:');
Object.keys(process.env).forEach(key => {
  if (key.includes('SMTP') || key.includes('MONGO') || key.includes('JWT') || key.includes('PORT') || key.includes('NODE')) {
    console.log(`${key}: ${process.env[key]}`);
  }
});