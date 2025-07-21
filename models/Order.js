import mongoose from 'mongoose';

// 🔹 Define transaction sub-schema
const transactionSchema = new mongoose.Schema({
  Total_Price: { type: mongoose.Schema.Types.Decimal128, required: true },
  Status: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending',
  },
  Created_At: { type: Date, default: Date.now },
});

// 🔹 Define order schema
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderItems: [
      {
        foodId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Food',
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    totalPrice: { type: Number, required: true },
    typeOfOrder: {
      type: String,
      enum: ['Delivery', 'Takeaway'],
      default: 'Delivery',
      required: true,
    },
     restaurant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: [true, 'restaurant_id is required']
  },
    orderStatus: {
      type: String,
      enum: ['Pending', 'Preparing', 'Delivering', 'Completed', 'Cancelled'],
      default: 'Pending',
    },
    // 🔹 Embedded transaction
    transaction: {
      type: transactionSchema,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
