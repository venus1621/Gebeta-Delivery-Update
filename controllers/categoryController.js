import FoodCategory from '../models/FoodCategory.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

// Create new category
export const createCategory = catchAsync(async (req, res, next) => {
  const category = await FoodCategory.create(req.body);
  res.status(201).json({
    status: 'success',
    data: category
  });
});

// Get all categories (optionally only active)
export const getAllCategories = catchAsync(async (req, res, next) => {
  const filter = req.query.active === 'false' ? {} : { isActive: true };
  const categories = await FoodCategory.find(filter);
  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: categories
  });
});

// Get a single category
export const getCategory = catchAsync(async (req, res, next) => {
  const category = await FoodCategory.findById(req.params.id);
  if (!category) return next(new AppError('Category not found', 404));

  res.status(200).json({
    status: 'success',
    data: category
  });
});

// Update a category
export const updateCategory = catchAsync(async (req, res, next) => {
  const category = await FoodCategory.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!category) return next(new AppError('Category not found', 404));

  res.status(200).json({
    status: 'success',
    data: category
  });
});

// Soft delete a category
export const deleteCategory = catchAsync(async (req, res, next) => {
  const category = await FoodCategory.findByIdAndUpdate(req.params.id, { isActive: false });

  if (!category) return next(new AppError('Category not found', 404));

  res.status(204).json({
    status: 'success',
    data: null
  });
});
