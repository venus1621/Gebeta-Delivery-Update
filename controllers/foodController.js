// controllers/foodController.js

import Food from '../models/Food.js';
import FoodMenu from '../models/FoodMenu.js';
import Restaurant from '../models/restaurantModel.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import cloudinary from '../utils/cloudinary.js';
import streamifier from 'streamifier';

// Upload image buffer to Cloudinary
const uploadFromBuffer = (fileBuffer, folder = 'food_images') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};


export const getFoodsByMenuId = catchAsync(async (req, res, next) => {
  const { menuId } = req.params;

  if (!menuId) {
    return next(new AppError('Menu ID is required.', 400));
  }

  const foods = await Food.find({ menuId }).populate('categoryId', 'categoryName');

  if (!foods.length) {
    return next(new AppError('No foods found for the given menu ID.', 404));
  }

  res.status(200).json({
    status: 'success',
    results: foods.length,
    data: {
      foods
    }
  });
});

// Middleware: attach image URL to req.body.image
export const uploadFoodImageToCloudinary = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  const result = await uploadFromBuffer(req.file.buffer);
  req.body.image = result.secure_url;

  next();
});

// Validate manager/admin ownership of menu
const checkManagerAccess = async (menuId, user) => {
  const menu = await FoodMenu.findById(menuId);
  if (!menu) throw new AppError('Food menu not found', 404);

  const restaurant = await Restaurant.findById(menu.restaurantId);
  if (!restaurant) throw new AppError('Restaurant not found', 404);

  // if ( restaurant.managerId.toString() !== user.id) {
  //   throw new AppError('Not authorized to access this menu', 403);
  // }

  return { menu, restaurant };
};

// Create a new food item
export const createFood = catchAsync(async (req, res, next) => {
  const { menuId } = req.body;
  await checkManagerAccess(menuId, req.user);

  const newFood = await Food.create(req.body);

  res.status(201).json({
    status: 'success',
    data: newFood
  });
});

// Get all foods with optional filters
export const getAllFoods = catchAsync(async (req, res, next) => {
  const queryObj = {};

  if (req.query.menuId) queryObj.menuId = req.query.menuId;
  if (req.query.categoryId) queryObj.categoryId = req.query.categoryId;

  if (req.query.restaurantId) {
    const menus = await FoodMenu.find({ restaurantId: req.query.restaurantId });
    queryObj.menuId = { $in: menus.map(menu => menu._id) };
  }

  if (req.query.status) queryObj.status = req.query.status;

  const foods = await Food.find(queryObj)
    .populate('menuId')
    .populate('categoryId');

  res.status(200).json({
    status: 'success',
    results: foods.length,
    data: foods
  });
});

// Get single food item
export const getFood = catchAsync(async (req, res, next) => {
  const food = await Food.findById(req.params.id)
    .populate('menuId')
    .populate('categoryId');

  if (!food) return next(new AppError('Food not found', 404));

  res.status(200).json({
    status: 'success',
    data: food
  });
});

// Update food
export const updateFood = catchAsync(async (req, res, next) => {
  const food = await Food.findById(req.params.id);
  if (!food) return next(new AppError('Food not found', 404));

  await checkManagerAccess(food.menuId, req.user);

  // Optional new image
  if (req.file) {
    const result = await uploadFromBuffer(req.file.buffer);
    req.body.image = result.secure_url;
  }

  const updatedFood = await Food.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: updatedFood
  });
});

// Soft delete food (mark as unavailable)
export const deleteFood = catchAsync(async (req, res, next) => {
  const food = await Food.findById(req.params.id);
  if (!food) return next(new AppError('Food not found', 404));

  await checkManagerAccess(food.menuId, req.user);

  food.status = 'Unavailable';
  await food.save();

  res.status(204).json({
    status: 'success',
    data: null
  });
});
