import FoodMenu from '../models/FoodMenu.js';
import Restaurant from '../models/restaurantModel.js';
import Food from '../models/Food.js'; // You forgot to import this
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

// CREATE a new menu
export const createMenu = catchAsync(async (req, res, next) => {
  const { restaurantId } = req.body;

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant || !restaurant.active) {
    return next(new AppError('Restaurant does not exist or is inactive', 404));
  }

  if (
    req.user.role !== 'Manager' &&
    restaurant.managerId.toString() !== req.user.id
  ) {
    return next(
      new AppError('You are not authorized to create a menu for this restaurant', 403)
    );
  }

  const menu = await FoodMenu.create(req.body);
  await menu.populate('restaurantId');

  res.status(201).json({
    status: 'success',
    data: menu
  });
});

// GET all menus (with filters)
export const getAllMenus = catchAsync(async (req, res, next) => {
  const queryObj = {};

  if (req.query.restaurantId) queryObj.restaurantId = req.query.restaurantId;
  if (req.query.menuType) queryObj.menuType = req.query.menuType;
  if (req.query.active) queryObj.active = req.query.active === 'true';

  const menus = await FoodMenu.find(queryObj).populate('restaurantId');

  res.status(200).json({
    status: 'success',
    results: menus.length,
    data: menus
  });
});

// GET single menu
// GET single menu
export const getMenu = catchAsync(async (req, res, next) => {
  const menu = await FoodMenu.findById(req.params.id);
  if (!menu) {
    return next(new AppError('Menu not found', 404));
  }

  // Find all foods linked to this menu
  const foods = await Food.find({ menuId: menu._id });

  res.status(200).json({
    status: 'success',
    data: {
      menu,
      foods
    }
  });
});

// UPDATE menu
export const updateMenu = catchAsync(async (req, res, next) => {
  const menu = await FoodMenu.findById(req.params.id);
  if (!menu) return next(new AppError('Menu not found', 404));

  const restaurant = await Restaurant.findById(menu.restaurantId);
  if (!restaurant) return next(new AppError('Restaurant not found', 404));

  if (
    req.user.role === 'Manager' &&
    restaurant.managerId.toString() !== req.user.id
  ) {
    return next(new AppError('You are not authorized to update this menu', 403));
  }

  const updatedMenu = await FoodMenu.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('restaurantId');

  res.status(200).json({
    status: 'success',
    data: updatedMenu
  });
});

// DELETE (soft) menu
export const deleteMenu = catchAsync(async (req, res, next) => {
  const menu = await FoodMenu.findById(req.params.id);
  if (!menu) return next(new AppError('Menu not found', 404));

  const restaurant = await Restaurant.findById(menu.restaurantId);
  if (!restaurant) return next(new AppError('Restaurant not found', 404));

  if (
    req.user.role === 'Manager' &&
    restaurant.managerId.toString() !== req.user.id
  ) {
    return next(new AppError('You are not authorized to delete this menu', 403));
  }

  menu.active = false;
  await menu.save();

  res.status(204).json({
    status: 'success',
    data: null
  });
});
