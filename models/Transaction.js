import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  cart_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart', required: true },
  Total_Price: { type: mongoose.Schema.Types.Decimal128, required: true },
  Status: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },
  Created_At: { type: Date, default: Date.now }
});

export default mongoose.model('Transaction', transactionSchema);
