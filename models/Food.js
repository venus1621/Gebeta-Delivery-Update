import mongoose from 'mongoose';

const foodSchema = new mongoose.Schema({
  foodName: { type: String, required: true, trim: true },
  price: { type: mongoose.Schema.Types.Decimal128, required: true },
  ingredients: { type: String },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory', required: true },
  instructions: { type: String },
  cookingTimeMinutes: { type: Number, min: 1 },
  rating: { type: mongoose.Schema.Types.Decimal128, default: 0 },
  menuId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodMenu', required: true },
  status: {
    type: String,
    enum: ['Available', 'Unavailable'],
    default: 'Available',
  },
}, { timestamps: true });

export default mongoose.model('Food', foodSchema);
