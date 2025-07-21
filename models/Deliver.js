import mongoose from 'mongoose';

const deliverSchema = new mongoose.Schema(
  {
    deliveryPersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    deliveryPrice: {
      type: Number,
      default: 0,
      min: [0, 'Delivery price cannot be negative'],
    },
    rating: {
      type: Number,
      min: [1, 'Minimum rating is 1'],
      max: [5, 'Maximum rating is 5'],
      default: 0,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    location: {
      type: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      required: [true, "Location is required from user's selected address coordinates"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Deliver', deliverSchema);
