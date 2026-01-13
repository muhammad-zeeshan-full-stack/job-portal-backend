import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 50 },
  username: { type: String, required: true, unique: true, lowercase: true, maxlength: 30 },
  email: { type: String, required: true, unique: true, validate: [validator.isEmail, "Invalid email"] },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ["candidate", "employer", "admin"], default: "candidate" },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  profile: {
    phone: String,
    address: String,
    avatar: String,
    resume: String,
    skills: [String],
    experience: [{ title: String, company: String, from: Date, to: Date, current: Boolean, description: String }],
    education: [{ school: String, degree: String, from: Date, to: Date, current: Boolean, description: String }],
  },
  createdAt: { type: Date, default: Date.now },
});

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// JWT token
userSchema.methods.getJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, { 
    expiresIn: process.env.JWT_EXPIRE || "7d" 
  });
};

// Generate email verification token (FIXED)
userSchema.methods.getEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(20).toString("hex");
  
  // Hash the token for storage
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  console.log(`Generated token - Plain: ${verificationToken}, Hashed: ${this.emailVerificationToken}`);
  
  return verificationToken; // Return plain token for email
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 mins
  return resetToken;
};

export default mongoose.model("User", userSchema);