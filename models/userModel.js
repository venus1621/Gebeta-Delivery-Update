import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import 'mongoose-geojson-schema';

// =======================
// Address Subschema
// =======================
const addressSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    label: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home'
    },
    additionalInfo: { type: String, trim: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (v) {
            return v.length === 2 &&
                   v[0] >= -180 && v[0] <= 180 &&
                   v[1] >= -90 && v[1] <= 90;
          },
          message: 'Coordinates must be [longitude, latitude] within valid ranges'
        }
      }
    }
  },
  { _id: true } // Each address gets its own ObjectId
);

// Enable geospatial queries
addressSchema.index({ location: '2dsphere' });

// =======================
// User Schema
// =======================
const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      validate: {
        validator: v => validator.isAlpha(v, 'en-US'),
        message: 'First name must contain only letters'
      },
      set: v => validator.escape(v)
    },

    lastName: {
      type: String,
      trim: true,
      validate: {
        validator: v => !v || validator.isAlpha(v, 'en-US'),
        message: 'Last name must contain only letters'
      },
      set: v => validator.escape(v)
    },

    phone: {
      type: String,
      unique: true,
      required: [true, 'Phone number is required'],
      validate: {
        validator: v => {
          const num = parsePhoneNumberFromString(v, 'ET');
          return num?.isValid();
        },
        message: props => `${props.value} is not a valid phone number`
      },
      set: v => {
        const num = parsePhoneNumberFromString(v, 'ET');
        return num ? num.format('E.164') : v;
      }
    },

    profilePicture: {
      type: String,
      validate: [validator.isURL, 'Profile picture must be a valid URL'],
      default: 'https://res.cloudinary.com/drinuph9d/image/upload/v1752830842/800px-User_icon_2.svg_vi5e9d.png'
    },

    password: {
      type: String,
      required: [true, 'Please provide a password'],
      select: false
    },

    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        validator: function (val) {
          return val === this.password;
        },
        message: 'Passwords do not match'
      }
    },

    addresses: {
      type: [addressSchema],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 3;
        },
        message: 'A user can only have up to 3 addresses'
      }
    },

    role: {
      type: String,
      enum: ['Customer', 'Manager', 'Delivery_Person', 'Admin'],
      default: 'Customer',
      required: true
    },

    firstLogin: {
      type: Boolean,
      default: function () {
        return this.role === 'Manager';
      },
      validate: {
        validator: function (v) {
          return this.role === 'Manager' ? true : v === false;
        },
        message: 'firstLogin can only be true for Managers.'
      }
    },

    fcnNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.role === 'Manager' || this.role === 'Delivery_Person') {
            return !!v;
          }
          return !v;
        },
        message:
          'FCN Number is required and must be for Managers and Delivery Persons only.'
      }
    },

    deliveryMethod: {
      type: String,
      enum: {
        values: ['Car', 'Motor', 'Bicycle'],
        message: '{VALUE} is not a valid delivery method'
      },
      validate: {
        validator: function (v) {
          if (this.role === 'Delivery_Person') return !!v;
          return !v;
        },
        message: function () {
          return this.role === 'Delivery_Person'
            ? 'Delivery method is required for Delivery_Person'
            : 'Only Delivery_Person can have a delivery method';
        }
      }
    },

    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    // ⭐ NEW: Flag to require password change on first login
    requirePasswordChange: {
      type: Boolean,
      default: false
    },

    passwordChangedAt: Date,

    active: {
      type: Boolean,
      default: true,
      select: false
    }
  },
  { timestamps: true }
);

// =======================
// Indexes
// =======================
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ active: 1 });
userSchema.index({ phone: 1, role: 1 });

// =======================
// Hooks
// =======================

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

// Track password change timestamp
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Query only active users
userSchema.pre(/^find/, function (next) {
  // If the query already specifies an 'active' field, skip automatic filtering
  if (this.getQuery().hasOwnProperty('active')) {
    return next();
  }
  // Otherwise, return only active users by default
  this.find({ active: { $ne: false } });
  next();
});

// =======================
// Instance Methods
// =======================

// Compare passwords
userSchema.methods.correctPassword = async function (candidatePassword, hashedPassword) {
  return bcrypt.compare(candidatePassword, hashedPassword);
};

// Check if password changed after JWT issue
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// =======================
// Export Model
// =======================
const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;