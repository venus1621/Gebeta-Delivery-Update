import FoodCategory from '../models/FoodCategory.js';

// Create new category
export const createCategory = async (req, res) => {
  try {
    const category = await FoodCategory.create(req.body);
    res.status(201).json({ status: 'success', data: category });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await FoodCategory.find();
    res.status(200).json({ status: 'success', results: categories.length, data: categories });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Get single category
export const getCategory = async (req, res) => {
  try {
    const category = await FoodCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    res.status(200).json({ status: 'success', data: category });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const category = await FoodCategory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    res.status(200).json({ status: 'success', data: category });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const category = await FoodCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
