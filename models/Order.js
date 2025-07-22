import mongoose from 'mongoose';

// 🔹 Transaction sub-schema
const transactionSchema = new mongoose.Schema({
  Total_Price: { type: mongoose.Schema.Types.Decimal128, required: true },
  Status: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending',
  },
  Created_At: { type: Date, default: Date.now },
});

// 🔹 Order schema
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

    // 🧾 Total prices breakdown
    foodTotal: { type: Number, required: true },          // New: food total
    deliveryFee: { type: Number, default: 0 },             // New: delivery fee
    totalPrice: { type: Number, required: true },          // Grand total = food + delivery

    typeOfOrder: {
      type: String,
      enum: ['Delivery', 'Takeaway'],
      default: 'Delivery',
      required: true,
    },

    restaurant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'restaurant_id is required'],
    },

    // 📍 Delivery address (if applicable)
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },

    orderStatus: {
      type: String,
      enum: ['Pending', 'Preparing', 'Delivering', 'Completed', 'Cancelled'],
      default: 'Pending',
    },

    // 🔗 Optional reference to Delivery document
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deliver',
    },

    transaction: {
      type: transactionSchema,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
