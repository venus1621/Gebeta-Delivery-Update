import Food from '../models/Food.js';
import FoodCategory from '../models/FoodCategory.js';
import FoodMenu from '../models/FoodMenu.js';

// Create a new food item
export const createFood = async (req, res) => {
  try {
    const food = await Food.create(req.body);
    res.status(201).json({ status: 'success', data: food });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Get all food items
export const getAllFood = async (req, res) => {
  try {
    const foods = await Food.find().populate('categoryId menuId');
    res.status(200).json({ status: 'success', results: foods.length, data: foods });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Get one food by ID
export const getFood = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id).populate('categoryId menuId');
    if (!food) return res.status(404).json({ message: 'Food not found' });
    res.status(200).json({ status: 'success', data: food });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Update food item
export const updateFood = async (req, res) => {
  try {
    const food = await Food.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!food) return res.status(404).json({ message: 'Food not found' });
    res.status(200).json({ status: 'success', data: food });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// Delete food item
export const deleteFood = async (req, res) => {
  try {
    const food = await Food.findByIdAndDelete(req.params.id);
    if (!food) return res.status(404).json({ message: 'Food not found' });
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
