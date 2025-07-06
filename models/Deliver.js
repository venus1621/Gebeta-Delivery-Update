import mongoose from 'mongoose';

const deliverSchema = new mongoose.Schema({
  deliveryPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cartId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart', required: true },
  feedback: { type: String },
  rating: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  deliveryPrice: { type: mongoose.Schema.Types.Decimal128, default: 0 },
}, { timestamps: true });

export default mongoose.model('Deliver', deliverSchema);
