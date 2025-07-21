import mongoose from 'mongoose';

const foodMenuSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  menuType: {
    type: String,
    enum: ['Breakfast', 'Lunch', 'Dinner', 'Special', 'Seasonal','other','vegan'],
    default: 'other',
  },
  active: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });


foodMenuSchema.index({ restaurantId: 1, menuType: 1 }, { unique: true });
export default mongoose.model('FoodMenu', foodMenuSchema);
