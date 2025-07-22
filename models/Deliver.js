import mongoose from 'mongoose';

const deliverSchema = new mongoose.Schema(
  {
   deliveryPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    rating: {
      type: Number,
      min: [1, 'Minimum rating is 1'],
      max: [5, 'Maximum rating is 5'],
      default: 1,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    deliveryStatus: {
      type: String,
      enum: ['Assigned','Pending', 'Completed', 'Cancelled'],
      default: 'Pending',
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
