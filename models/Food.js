import mongoose from 'mongoose';

const foodSchema = new mongoose.Schema({
  foodName: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  ingredients: { type: String },
  instructions: { type: String },
  cookingTimeMinutes: { type: Number, min: 1 },
  rating: { type: Number, default: 0 },
  imageCover: { type: String },
  isFeatured: { type: Boolean, default: false },

  
  menuId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodMenu',
    required: true
  },
  status: {
    type: String,
    enum: ['Available', 'Unavailable'],
    default: 'Available'
  }
}, { timestamps: true });

export default mongoose.model('Food', foodSchema);
