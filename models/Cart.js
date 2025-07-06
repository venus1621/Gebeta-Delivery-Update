import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  quantity: { type: Number, default: 1, min: 1 },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['Pending', 'Delivering', 'Delivered'],
    default: 'Pending',
  },
  deliveryAddress: { type: String },
  orderItems: [orderItemSchema],
}, { timestamps: true });

export default mongoose.model('Cart', cartSchema);
