import FoodMenu from '../models/FoodMenu.js';

// CREATE a new food menu
export const createMenu = async (req, res) => {
  try {
    const menu = await FoodMenu.create(req.body);
    res.status(201).json({ status: 'success', data: menu });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// READ all food menus
export const getAllMenus = async (req, res) => {
  try {
    const menus = await FoodMenu.find().populate('restaurantId');
    res.status(200).json({
      status: 'success',
      results: menus.length,
      data: menus
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// READ one menu by ID
export const getMenu = async (req, res) => {
  try {
    const menu = await FoodMenu.findById(req.params.id).populate('restaurantId');
    if (!menu) return res.status(404).json({ status: 'fail', message: 'Menu not found' });

    res.status(200).json({ status: 'success', data: menu });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// UPDATE a food menu
export const updateMenu = async (req, res) => {
  try {
    const menu = await FoodMenu.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!menu) return res.status(404).json({ status: 'fail', message: 'Menu not found' });

    res.status(200).json({ status: 'success', data: menu });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// DELETE a food menu
export const deleteMenu = async (req, res) => {
  try {
    const menu = await FoodMenu.findByIdAndDelete(req.params.id);
    if (!menu) return res.status(404).json({ status: 'fail', message: 'Menu not found' });

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
