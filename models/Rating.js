import mongoose from 'mongoose';

/**
 * Rating Schema for MongoDB using Mongoose
 * @module models/Rating
 */
const ratingSchema = new mongoose.Schema(
  {
    // Rating Content
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment must not exceed 1000 characters'],
      minlength: [10, 'Comment must be at least 10 characters long if provided'],
      required: false // Optional comment
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must not exceed 5'],
      required: [true, 'Rating is required'],
      validate: {
        validator: function (value) {
          return Number.isInteger(value);
        },
        message: 'Rating must be an integer between 1 and 5'
      }
    },

    // References
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Rating must belong to a restaurant'],
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Rating must be submitted by a user'],
      index: true
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      select: false
    },
    updatedAt: {
      type: Date,
      select: false
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
 * Ensure unique ratings per user per restaurant
 */
ratingSchema.index({ restaurant: 1, user: 1 }, { unique: true });

/**
 * Optimize queries by restaurant
 */
ratingSchema.index({ restaurant: 1, createdAt: -1 });

/**
 * Optimize queries by user
 */
ratingSchema.index({ user: 1, createdAt: -1 });

// Middleware
/**
 * Populate user information in queries
 */
ratingSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'firstName lastName email'
  });
  next();
});

/**
 * Update restaurant rating metrics after saving a rating
 */
ratingSchema.post('save', async function () {
  await mongoose.model('Restaurant').updateRatingMetrics(this.restaurant);
});

/**
 * Update restaurant rating metrics after updating or deleting a rating
 */
ratingSchema.post(/^findOneAnd/, async function (doc) {
  if (doc) {
    await mongoose.model('Restaurant').updateRatingMetrics(doc.restaurant);
  }
});

/**
 * Handle duplicate rating errors
 */
ratingSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('User has already rated this restaurant'));
  } else {
    next(error);
  }
});

// Model
const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;