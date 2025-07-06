import mongoose from 'mongoose';

const foodMenuSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  menuType: {
    type: String,
    enum: ['Breakfast', 'Lunch', 'Dinner', 'Special', 'Seasonal'],
    default: 'Lunch',
  },
}, { timestamps: true });

export default mongoose.model('FoodMenu', foodMenuSchema);
