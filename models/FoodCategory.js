import mongoose from 'mongoose';

const foodCategorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters long'],
      maxlength: [50, 'Category name must not exceed 50 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description must not exceed 200 characters'],
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export default mongoose.model('FoodCategory', foodCategorySchema);
