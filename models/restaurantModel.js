import mongoose from 'mongoose';
import slugify from 'slugify';

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A restaurant must have a name'],
      unique: true,
      trim: true,
      maxlength: [50, 'Name must be at most 50 characters'],
      minlength: [3, 'Name must be at least 3 characters']
    },
    slug: String,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true
      },
      coordinates: {
        type: [Number],
        required: true
      },
      address: {
        type: String,
        required: true,
        trim: true
      },
      description: String
    },
    deliveryRadiusMeters: {
      type: Number,
      default: 3000,
      min: [500, 'Delivery radius must be at least 500m']
    },
    license: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    cuisineTypes: {
      type: [String],
      enum: {
        values: ['Ethiopian', 'Italian', 'Chinese', 'Indian', 'Fast Food', 'Vegan'],
        message: 'Not a supported cuisine'
      },
      default: []
    },
    imageCover: {
      type: String,
      default: 'default-restaurant.jpg'
    },
    gallery: [String],
    ratingAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: val => Math.round(val * 10) / 10
    },
    ratingQuantity: {
      type: Number,
      default: 0
    },
    openHours: {
      type: String,
      default: '9:00 AM - 9:00 PM'
    },
    isDeliveryAvailable: {
      type: Boolean,
      default: true
    },
    isOpenNow: {
      type: Boolean,
      default: true
    },
    secretRestaurant: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Generate slug from name
restaurantSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Exclude secret restaurants
restaurantSchema.pre(/^find/, function (next) {
  this.find({ secretRestaurant: { $ne: true } });
  next();
});

// Virtual populate for reviews
restaurantSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'restaurant',
  localField: '_id'
});

// Virtual description snippet
restaurantSchema.virtual('shortDescription').get(function () {
  return this.location.description?.length > 50
    ? this.location.description.substring(0, 50) + '...'
    : this.location.description;
});

// Indexes
restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ slug: 1 });
restaurantSchema.index({ license: 1 });

export default mongoose.model('Restaurant', restaurantSchema);
