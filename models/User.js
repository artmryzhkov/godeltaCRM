const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name'],
    minLength: [4, 'Name must be at least 4 letter long, got {VALUE}'],
    maxLength: [24, 'Name cannot be greater then 24 letter, got {VALUE}'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    validate: [validator.isEmail, 'Please enter a valid email'],
    trim: true,
    lowercase: true,
    unique: true,
  },
  image: {
    type: String,
    default: 'http://127.0.0.1:5000/img/users/default.jpg',
  },
  role: {
    type: String,
    enum: ['Driver', 'Admin'],
    default: 'Driver',
  },
  password: {
    type: String,
    required: [true, 'Please enter your password'],
    minlength: 8,
    select: false,
  },
  confirmPassword: {
    type: String,
    required: [true, 'Please re-enter your password'],
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: "Password didn't matched!",
    },
  },
  passChangedAt: {
    type: Date,
    select: false,
  },
  passResetToken: String,
  passResetExpire: Date,
  expiresAt: {
    type: Date,
    select: false,
    default: Date.now() + process.env.ACCOUNT_EXPIRES * 24 * 60 * 60 * 1000,
  },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  emailValidationToken: String,
  validEmail: {
    type: Boolean,
    default: false,
    select: false,
  },
});

// prettier-ignore
userSchema.index({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.confirmPassword = undefined;
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

userSchema.methods.comparePassword = async function (c, u) {
  return await bcrypt.compare(c, u);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passChangedAt) {
    const changedPassAt = parseInt(this.passChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedPassAt;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passResetExpire = Date.now() + 10 * 60 * 1000;

  console.log({ resetToken }, this.passResetToken);

  return resetToken;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
