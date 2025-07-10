import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'Please tell us your first name'],
      trim: true,
      default:'User'
    },
    lastName: {
      type: String,
      trim: true,
    },
    phone: {
  type: String,
  required: [true, 'Please provide your phone number'],
  unique: true,
  trim: true,
  validate: {
    validator: function (v) {
      // Allow 9XXXXXXXX or +2519XXXXXXXX
      return /^(\+2519\d{8}|9\d{8})$/.test(v);
    },
    message: props => `${props.value} is not a valid Ethiopian phone number`
  }
},
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: 'Please provide a valid email',
      },
    },
    profilePicture: String,

    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      select: false,
     
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        validator: function (val) {
          return val === this.password;
        },
        message: 'Passwords do not match!',
      },
     
    },
   addresses: [
  {
    Name:{type:String},
    label: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home'
    },
    additionalInfo: String,
    isDefault: {
      type: Boolean,
      default: false
    },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  }
]

,
    role: {
      type: String,
      enum: ['Customer', 'Manager', 'Delivery_Person', 'Admin'],
      default: 'Customer',
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    signupOTP: String,
    signupOTPExpires: Date,
    passwordResetOTP: String,
    resetPasswordOTPExpires: Date,

    passwordChangedAt: Date,

    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

// Set passwordChangedAt timestamp
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Filter only active users
userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

// Compare password method
userSchema.methods.correctPassword = async function (candidatePassword, hashedPassword) {
  return await bcrypt.compare(candidatePassword, hashedPassword);
};

// Check if password was changed after token issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Generate signup OTP
userSchema.methods.createSignupOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.signupOTP = bcrypt.hashSync(otp, 12);
  this.signupOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

// Generate reset password OTP
userSchema.methods.createPasswordResetOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.passwordResetOTP = bcrypt.hashSync(otp, 12);
  this.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

// Match OTP
userSchema.methods.verifyOTP = function (plainOTP, hashedOTP) {
  return bcrypt.compareSync(plainOTP, hashedOTP);
};

const User = mongoose.model('User', userSchema);
export default User;
