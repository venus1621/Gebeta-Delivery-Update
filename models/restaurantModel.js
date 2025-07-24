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
        required: true,
        default: [0, 0], // International default: [longitude, latitude]
        validate: {
          validator: function (val) {
            return val.length === 2;
          },
          message: 'Coordinates must be [longitude, latitude]'
        }
      },
      address: {
        type: String,
        required: true,
        trim: true,
        default: 'International Default Location'
      },
      description: {
        type: String,
        default: 'Default global coordinates (0°, 0°)'
      }
    }, // ← ✅ Missing comma was here
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
      required: true,
      validate: {
        validator: async function (id) {
          const user = await mongoose.model('User').findById(id);
          return user?.role === 'Manager';
        },
        message: 'Assigned managerId must belong to a user with Manager role'
      }
    },
    cuisineTypes: {
      type: [String],
      enum: {
        values: ['Ethiopian', 'Italian', 'Chinese', 'Indian', 'Fast Food', 'Vegan', 'Other'],
        message: 'Not a supported cuisine'
      },
      default: []
    },
    imageCover: {
      type: String,
      default: 'https://console.cloudinary.com/app/c-e6424795bfdb4b35ccc8c9b7873ed2/assets/media_library/folders/cc1e40b24e89281c5e115867dd9f8dc9b6/asset/ddebcb0913050e88cdb318d47375deb4/manage/summary?view_mode=mosaic&context=manage'
    },
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
      default: true // ❗ should be updated dynamically
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// SLUG on Save
restaurantSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// SLUG on Update
restaurantSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true });
    this.setUpdate(update);
  }
  next();
});

// Exclude inactive
restaurantSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

// Virtual Populate
restaurantSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'restaurant',
  localField: '_id'
});

restaurantSchema.virtual('shortDescription').get(function () {
  return this.location.description?.length > 50
    ? this.location.description.substring(0, 50) + '...'
    : this.location.description;
});

restaurantSchema.virtual('reviewCount').get(function () {
  return this.reviews?.length || 0;
});

// Indexes
restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ slug: 1 });
restaurantSchema.index({ managerId: 1 });

export default mongoose.model('Restaurant', restaurantSchema);
