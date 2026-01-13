import crypto from "crypto";
import User from "../models/User.js";
import sendEmail from "../config/email.js";

// Send JWT in cookie
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getJwtToken();
  const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 7;

  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  };

  res
    .status(statusCode)
    .cookie("token", token, options)
    .json({
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

// -------------------- REGISTER --------------------
export const register = async (req, res, next) => {
  try {
    console.log("Registration request body:", req.body);
    
    const { name, username, email, password, role } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "User already exists with this email or username" 
      });
    }

    // Create user
    const user = await User.create({ 
      name, 
      username, 
      email, 
      password, 
      role: role || "candidate" 
    });

    console.log(`User created: ${user.email}`);

    // Generate and save verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    console.log(`Verification token generated: ${verificationToken}`);
    console.log(`Hashed token in DB: ${user.emailVerificationToken}`);

    // Create verification URL
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    
    console.log(`Verification URL: ${verificationUrl}`);

    // Email content
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Verify Your Email Address</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for registering with JobPortal. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="background-color: #f3f4f6; padding: 10px; border-radius: 5px; word-break: break-all;">
          ${verificationUrl}
        </p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          © ${new Date().getFullYear()} JobPortal. All rights reserved.
        </p>
      </div>
    `;

    const message = `Verify your email by clicking this link: ${verificationUrl}`;

    try {
      await sendEmail({ 
        email: user.email, 
        subject: "Verify Your Email - JobPortal", 
        message, 
        html 
      });
      
      console.log(`Verification email sent to ${user.email}`);

      sendTokenResponse(user, 201, res);
      
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      
      // Clean up verification tokens on email failure
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: "Verification email could not be sent. Please try again later.",
      });
    }

  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};

// -------------------- VERIFY EMAIL (FIXED) --------------------
export const verifyEmail = async (req, res, next) => {
  try {
    let { token } = req.params;
    
    console.log(`Verification attempt - Original Token from URL: "${token}"`);
    console.log(`Original Token length: ${token.length}`);
    
    // Remove any leading colon or special characters (common issue with Next.js routing)
    if (token.startsWith(':')) {
      token = token.substring(1);
      console.log(`Fixed token after removing colon: "${token}"`);
      console.log(`Fixed token length: ${token.length}`);
    }
    
    // Trim whitespace
    token = token.trim();
    
    // Accept tokens between 40-42 characters to be more flexible
    if (!token || token.length < 40 || token.length > 42) {
      console.log(`Token validation failed. Length: ${token.length}, Expected: 40-42`);
      return res.status(400).json({
        success: false,
        message: "Invalid token format. Please use the link from your email."
      });
    }

    // Hash the token from URL
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    console.log(`Hashed token: ${hashedToken}`);

    // Find user by hashed token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      console.log("Token verification failed - No user found or token expired");
      
      // Debug: Show what's in the database
      const allUsers = await User.find({ emailVerificationToken: { $exists: true } });
      console.log("Users with verification tokens in DB:");
      allUsers.forEach(u => {
        console.log(`- ${u.email}: ${u.emailVerificationToken}`);
      });
      
      // Check if token exists but expired
      const userWithToken = await User.findOne({
        emailVerificationToken: hashedToken
      });
      
      if (userWithToken) {
        console.log(`Found user with token but expired: ${userWithToken.email}`);
        console.log(`Token expires at: ${new Date(userWithToken.emailVerificationExpire).toISOString()}`);
        console.log(`Current time: ${new Date().toISOString()}`);
        
        return res.status(400).json({
          success: false,
          message: "Verification token has expired. Please request a new verification email."
        });
      }
      
      return res.status(400).json({
        success: false,
        message: "Invalid verification token. Please try registering again."
      });
    }

    console.log(`User found: ${user.email}`);
    console.log(`User ID: ${user._id}`);

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    console.log(`Email verified for: ${user.email}`);

    // Generate new JWT token with updated verification status
    const newToken = user.getJwtToken();
    
    res.status(200).json({
      success: true,
      token: newToken, // Send new token with verified status
      message: "🎉 Email verified successfully! You can now log in to your account.",
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

// -------------------- LOGIN --------------------
export const login = async (req, res, next) => {
  try {
    console.log("Login attempt for:", req.body.email);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide both email and password" 
      });
    }

    // Find user with password field
    const user = await User.findOne({ email }).select("+password");
    
    if (!user) {
      console.log("No user found with email:", email);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log("Password mismatch for:", email);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log("Email not verified for:", email);
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification email.",
        requiresVerification: true
      });
    }

    console.log("Login successful for:", email);
    sendTokenResponse(user, 200, res);

  } catch (error) {
    console.error("Login error:", error);
    next(error);
  }
};

// -------------------- RESEND VERIFICATION --------------------
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

    // Generate new verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Verify Your Email Address</h2>
        <p>Hello ${user.name},</p>
        <p>We received a request to resend the verification email. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>This link will expire in 24 hours.</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "Resend: Verify Your Email - JobPortal",
      message: `Verify your email: ${verificationUrl}`,
      html
    });

    res.status(200).json({
      success: true,
      message: "Verification email resent successfully"
    });

  } catch (error) {
    console.error("Resend verification error:", error);
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

// -------------------- LOGOUT --------------------
export const logout = async (req, res, next) => {
  try {
    res.clearCookie("token");
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Logout error:", error);
    next(error);
  }
};