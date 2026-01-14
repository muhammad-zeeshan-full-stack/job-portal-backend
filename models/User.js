import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
    maxlength: [50, "Name cannot be more than 50 characters"]
  },
  username: {
    type: String,
    required: [true, "Please add a username"],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, "Username must be at least 3 characters"],
    maxlength: [30, "Username cannot be more than 30 characters"]
  },
  email: {
    type: String,
    required: [true, "Please add an email"],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email"
    ]
  },
  password: {
    type: String,
    required: [true, "Please add a password"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false
  },
  role: {
    type: String,
    enum: ["candidate", "employer", "admin"],
    default: "candidate"
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  profileImage: {
    type: String,
    default: ""
  },
  phone: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) {
    next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Sign JWT and return
UserSchema.methods.getJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Compare user password
UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
UserSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expire
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes

  return resetToken;
};

const User = mongoose.model("User", UserSchema);
export default User;