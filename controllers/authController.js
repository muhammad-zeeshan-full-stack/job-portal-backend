import crypto from "crypto";
import User from "../models/User.js";
import sendEmail from "../config/email.js";
import dotenv from 'dotenv';
dotenv.config();


console.log('✅ [DEBUG] Auth routes loaded');

// SIMPLE REGISTER ENDPOINT FOR TESTING
export const register = async (req, res) => {
  console.log('\n🔍 [DEBUG] ===== REGISTER ENDPOINT CALLED =====');
  console.log('📦 Request body:', req.body);
  
  try {
    const { name, email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      console.log('❌ Validation failed: Email and password required');
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }
    
    // Check if user exists
    console.log('🔍 Checking if user exists with email:', email);
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      console.log('❌ User already exists');
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }
    
    // Create user
    console.log('🔍 Creating new user...');
    const user = await User.create({
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      password,
      username: email.split('@')[0] + Date.now().toString().slice(-4),
      role: 'candidate'
    });
    
    console.log('✅ User created with ID:', user._id);
    
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🔍 Generated verification code:', verificationCode);
    
    // Update user with verification code
    user.emailVerificationToken = verificationCode;
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });
    
    // Try to send email
    console.log('🔍 Attempting to send verification email...');
    const emailResult = await sendEmail({
      email: user.email,
      subject: "Verify Your Email - Job Portal",
      message: `Your verification code is: ${verificationCode}`
    });
    
    console.log('📧 Email result:', emailResult);
    
    // Send response
    console.log('✅ Registration successful!');
    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email for verification code.",
      data: {
        userId: user._id,
        email: user.email,
        verificationCode: process.env.NODE_ENV === 'development' ? verificationCode : undefined
      }
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
      error: error.message
    });
  }
};

// TEST LOGIN
export const login = async (req, res) => {
  console.log('\n🔍 [DEBUG] ===== LOGIN ENDPOINT CALLED =====');
  console.log('📦 Request body:', req.body);
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required"
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }
    
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }
    
    const token = user.getJwtToken();
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
};

// VERIFY EMAIL
export const verifyEmail = async (req, res, next) => {
  console.log('\n🔍 [DEBUG] ===== VERIFY EMAIL REQUEST =====');
  console.log('🔍 [DEBUG] Request Body:', req.body);
  
  try {
    const { token, email } = req.body;
    
    if (!token || !email) {
      console.log('❌ [DEBUG] Missing token or email');
      return res.status(400).json({
        success: false,
        message: "Token and email are required"
      });
    }

    console.log('🔍 [DEBUG] Looking for user with email:', email, 'and token:', token);
    
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationToken: token,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      console.log('❌ [DEBUG] Invalid or expired token');
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code"
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    // Generate JWT token
    const jwtToken = user.getJwtToken();
    
    console.log('✅ [DEBUG] Email verified for user:', user.email);
    
    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: true
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Verification error:', error.message);
    res.status(500).json({
      success: false,
      message: "Verification failed"
    });
  }
};



// GET CURRENT USER
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email"
      });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    await sendEmail({
      email: user.email,
      subject: "Password Reset Request",
      message: `Reset your password: ${resetUrl}`
    });

    res.status(200).json({
      success: true,
      message: "Password reset email sent"
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to process request"
    });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful"
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password"
    });
  }
};

// LOGOUT
export const logout = async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};