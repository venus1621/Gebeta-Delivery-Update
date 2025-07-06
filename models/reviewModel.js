import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review must not be empty'],
      trim: true
    },
    rating: {
      type: Number,
      required: [true, 'Review must have a rating'],
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Review must belong to a restaurant']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must be written by a user']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Prevent duplicate reviews per user per restaurant
reviewSchema.index({ restaurant: 1, user: 1 }, { unique: true });

// Populate user info on query
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'firstName lastName email'
  });
  next();
});

// Static method to calculate average rating & count
reviewSchema.statics.calcAverageRatings = async function (restaurantId) {
  const stats = await this.aggregate([
    { $match: { restaurant: restaurantId } },
    {
      $group: {
        _id: '$restaurant',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);

  if (stats.length > 0) {
    await mongoose.model('Restaurant').findByIdAndUpdate(restaurantId, {
      ratingQuantity: stats[0].nRating,
      ratingAverage: stats[0].avgRating
    });
  } else {
    await mongoose.model('Restaurant').findByIdAndUpdate(restaurantId, {
      ratingQuantity: 0,
      ratingAverage: 4.5
    });
  }
};

// Call aggregation after save/update/delete
reviewSchema.post('save', function () {
  this.constructor.calcAverageRatings(this.restaurant);
});

reviewSchema.post(/^findOneAnd/, async function (doc) {
  if (doc) await doc.constructor.calcAverageRatings(doc.restaurant);
});

export default mongoose.model('Review', reviewSchema);
