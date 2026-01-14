











import crypto from "crypto";
import User from "../models/User.js";
import sendEmail from "../config/email.js";

// Send JWT response (without cookie)
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getJwtToken();
  
  res.status(statusCode).json({
    success: true,
    token,
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      username: user.username,
      isEmailVerified: user.isEmailVerified 
    },
  });
};


// REGISTER - IMPROVED VERSION
export const register = async (req, res, next) => {
  try {
    console.log("Registration attempt:", req.body);
    
    const { name, fullName, username, email, password, role } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    // Generate username if not provided
    const safeUsername = username || 
      email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, '') + 
      Math.floor(Math.random() * 1000);

    // Check if username already exists
    const existingUsername = await User.findOne({ username: safeUsername });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: "Username already taken"
      });
    }

    // Create user
    const user = await User.create({
      name: name || fullName || email.split("@")[0],
      username: safeUsername,
      email: email.toLowerCase(),
      password,
      role: role || "candidate",
      isEmailVerified: false
    });

    console.log("User created:", user._id);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save verification token
    user.emailVerificationToken = verificationCode;
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    // Try to send email (but don't fail registration if email fails)
    try {
      await sendEmail({
        email: user.email,
        subject: "Verify Your Email - JobPortal",
        message: `Your verification code is: ${verificationCode}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Verify Your Email</h2>
            <p>Hello ${user.name},</p>
            <p>Thank you for registering! Please use the following 6-digit code to verify your email:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; display: inline-block;">
                <h3 style="color: #2563eb; font-size: 32px; letter-spacing: 8px; margin: 0;">
                  ${verificationCode}
                </h3>
              </div>
            </div>
            <p>Enter this code on the verification page to complete your registration.</p>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
        `
      });
      console.log("Verification email sent to:", user.email);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail registration if email fails
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email for verification code.",
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        requiresVerification: true
      }
    });

  } catch (error) {
    console.error("Registration error details:", error);
    
    // Handle specific Mongoose errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate field value entered",
        field: Object.keys(error.keyPattern)[0]
      });
    }

    // General server error
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error during registration",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


// -------------------- VERIFY EMAIL WITH 6-DIGIT TOKEN --------------------
export const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.body;
    
    console.log(`Verification attempt - Email: ${email}, Token: ${token}`);
    
    if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid token format. Please enter a valid 6-digit code."
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required for verification."
      });
    }

    // Find user by email and token
    const user = await User.findOne({
      email,
      emailVerificationToken: token,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      console.log("Token verification failed - No user found or token expired");
      
      // Check if token exists but expired
      const userWithToken = await User.findOne({ email, emailVerificationToken: token });
      
      if (userWithToken) {
        console.log(`Found user with token but expired: ${userWithToken.email}`);
        return res.status(400).json({
          success: false,
          message: "Verification token has expired. Please request a new verification code."
        });
      }
      
      return res.status(400).json({
        success: false,
        message: "Invalid verification token. Please check your email and try again."
      });
    }

    console.log(`User found: ${user.email}`);

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    console.log(`Email verified for: ${user.email}`);

    // Generate JWT token
    const newToken = user.getJwtToken();
    
    res.status(200).json({
      success: true,
      token: newToken,
      message: "🎉 Email verified successfully!",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isEmailVerified: true
      }
    });

  } catch (error) {
    console.error("Email verification error:", error);
    next(error);
  }
};

// -------------------- RESEND VERIFICATION (UPDATED) --------------------
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified"
      });
    }

    // Generate new 6-digit verification token
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Verification Code</h2>
        <p>Hello ${user.name},</p>
        <p>We received a request to resend the verification code. Please use the following 6-digit code to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; display: inline-block;">
            <h3 style="color: #2563eb; font-size: 32px; letter-spacing: 8px; margin: 0;">
              ${verificationToken}
            </h3>
          </div>
        </div>
        <p>Enter this code on the verification page to complete your registration.</p>
        <p><strong>This code will expire in 10 minutes.</strong></p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "New Verification Code - JobPortal",
      message: `Your new verification code is: ${verificationToken}`,
      html
    });

    res.status(200).json({
      success: true,
      message: "New verification code sent successfully"
    });

  } catch (error) {
    console.error("Resend verification error:", error);
    next(error);
  }
};

// LOGIN
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (!user.isEmailVerified) {
      return res.status(403).json({ success: false, message: "Email verify کریں" });
    }

    const token = user.getJwtToken();
    res.status(200).json({ success: true, token, user });

  } catch (error) {
    next(error);
  }
};


// -------------------- FORGOT PASSWORD --------------------
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email"
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Reset Your Password</h2>
        <p>Hello ${user.name},</p>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link:</p>
        <p style="background-color: #f3f4f6; padding: 10px; border-radius: 5px; word-break: break-all;">
          ${resetUrl}
        </p>
        <p>This link will expire in 30 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Request - JobPortal",
      message: `Reset your password: ${resetUrl}`,
      html
    });

    res.status(200).json({
      success: true,
      message: "Password reset email sent successfully"
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    next(error);
  }
};

// -------------------- RESET PASSWORD --------------------
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    // Hash the token from URL
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Send confirmation email
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Password Reset Successful</h2>
        <p>Hello ${user.name},</p>
        <p>Your password has been successfully reset.</p>
        <p>If you did not make this change, please contact our support immediately.</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Successful - JobPortal",
      message: "Your password has been reset successfully.",
      html
    });

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login with your new password."
    });

  } catch (error) {
    console.error("Reset password error:", error);
    next(error);
  }
};

// -------------------- GET ME --------------------
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-__v");
    
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
    console.error("Get me error:", error);
    next(error);
  }
};

// -------------------- LOGOUT (SIMPLIFIED) --------------------
export const logout = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Logout error:", error);
    next(error);
  }
};

// ... Keep the rest of the functions (getMe, forgotPassword, resetPassword) the same, 
// just remove any cookie references if they exist