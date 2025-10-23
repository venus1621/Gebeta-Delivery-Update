import mongoose from 'mongoose';
import 'mongoose-geojson-schema';

/**
 * Restaurant Schema for MongoDB using Mongoose
 * @module models/Restaurant
 */
const restaurantSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
     
      trim: true,
      maxlength: [100, 'Restaurant name must not exceed 100 characters'],
      minlength: [3, 'Restaurant name must be at least 3 characters long']
    },
    
    location: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        default: undefined, // Optional coordinates
        validate: {
          validator: function (coords) {
            if (!coords) return true; // Allow undefined/null for optional coordinates
            const [lng, lat] = coords;
            return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
          },
          message: 'Coordinates must be [longitude, latitude] with longitude [-180, 180] and latitude [-90, 90] or omitted'
        }
      },
      address: {
        type: String,
        trim: true,
        maxlength: [200, 'Address must not exceed 200 characters']
      }
    },

    // Restaurant Details
    description: {
      type: String,
      trim: true,
      default: 'New Restaurant',
      maxlength: [500, 'Description must not exceed 500 characters']
    },
    license: {
      type: String,
      required: [true, 'License number is required'],
      unique: true,
      trim: true,
    },
    cuisineTypes: {
      type: [String],
      validate: {
        validator: function (cuisines) {
          return cuisines.every(cuisine => 
            typeof cuisine === 'string' && 
            cuisine.length >= 2 && 
            cuisine.length <= 50 && 
            /^[A-Za-z\s]+$/.test(cuisine)
          );
        },
        message: 'Each cuisine type must be a string between 2 and 50 characters, containing only letters and spaces'
      },
      default: ['Other']
    },
    imageCover: {
      type: String,
      default: 'https://res.cloudinary.com/drinuph9d/image/upload/v1753361848/lounge_x1dq2d.jpg',
    },

    // Management
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Manager ID is required'],
      validate: {
        validator: async function (id) {
          const user = await mongoose.model('User').findById(id);
          return user?.role === 'Manager';
        },
        message: 'Assigned managerId must belong to a user with Manager role'
      }
    },

    // Operating Hours
    openHours: [
    {
      day: {
        type: String,
        enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        required: true
      },
      from: { type: String, required: true }, // e.g. "08:00"
      to: { type: String, required: true },   // e.g. "18:00"
      isClosed: { type: Boolean, default: false }
    }
  ],

    
    isOpenNow: {
    type: Boolean,
    default: function () {
      const now = new Date();
      const dayIndex = now.getDay();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[dayIndex];

      // Current time in HH:MM
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes()
        .toString()
        .padStart(2, '0')}`;

      const daySchedule = this.openHours.find(s => s.day === currentDay);
      if (!daySchedule || daySchedule.isClosed) return false;

      return currentTime >= daySchedule.from && currentTime <= daySchedule.to;
    }
  },
    // Status
    isDeliveryAvailable: {
      type: Boolean,
      default: true
    },
    active: {
      type: Boolean,
      default: true,
      select: false
    },

    // Cached Rating Metrics
    ratingAverage: {
      type: Number,
      default: 1,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5']
    },
    ratingQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Rating quantity cannot be negative']
    },
    // Rating Reference
    rating: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Rating' }]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
/**
 * Optimize geospatial queries
 */
restaurantSchema.index(
  { location: '2dsphere' },
  {
    sparse: true,
    partialFilterExpression: { 'location.coordinates': { $exists: true } }
  }
);
/**
 * Optimize queries by manager
 */
restaurantSchema.index({ managerId: 1 });

// Middleware
/**
 * Filter out inactive restaurants unless includeInactive is specified
 */
restaurantSchema.pre(/^find/, function (next) {
  if (this.getOptions().includeInactive) return next();
  this.find({ active: { $ne: false } });
  next();
});

/**
 * Validate managerId only on create
 */
restaurantSchema.pre('save', async function (next) {
  if (!this.isNew) return next(); // Skip validation on updates
  const user = await mongoose.model('User').findById(this.managerId);
  if (!user || user.role !== 'Manager') {
    return next(new Error('Assigned managerId must belong to a user with Manager role'));
  }
  next();
});

/**
 * Handle duplicate key errors
 */
restaurantSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`Duplicate ${field}: ${error.keyValue[field]} must be unique`));
  } else {
    next(error);
  }
});

// Virtuals
/**
 * Get short description (first 50 characters)
 */
restaurantSchema.virtual('shortDescription').get(function () {
  return this.description?.length > 50
    ? this.description.substring(0, 50) + '...'
    : this.description;
});

// Static method to update rating metrics
restaurantSchema.statics.updateRatingMetrics = async function (restaurantId) {
  const ratings = await mongoose.model('Rating').find({ restaurant: restaurantId });
  const validRatings = ratings.filter(rating => rating.rating !== undefined);
  const ratingQuantity = validRatings.length;
  const ratingAverage = ratingQuantity > 0
    ? Math.round((validRatings.reduce((acc, r) => acc + r.rating, 0) / ratingQuantity) * 10) / 10
    : 4.5;

  await this.findByIdAndUpdate(restaurantId, {
    ratingAverage,
    ratingQuantity
  });
};

// Model
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

export default Restaurant;