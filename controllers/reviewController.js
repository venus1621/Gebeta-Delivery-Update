import Review from '../models/reviewModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

// Middleware: Set restaurant and user IDs for nested routes
export const setRestaurantUserIds = (req, res, next) => {
  if (!req.body.restaurant) req.body.restaurant = req.params.restaurantId;
  if (!req.body.user) req.body.user = req.user.id;
  next();
};

// ✅ Get all reviews (optionally for one restaurant)
export const getAllReviews = catchAsync(async (req, res, next) => {
  const filter = req.params.restaurantId ? { restaurant: req.params.restaurantId } : {};
  const reviews = await Review.find(filter).populate('restaurant user');

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: { reviews }
  });
});

// ✅ Get single review
export const getReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate('restaurant user');
  if (!review) return next(new AppError('No review found with that ID', 404));

  res.status(200).json({
    status: 'success',
    data: { review }
  });
});

// ✅ Create a new review
export const createReview = catchAsync(async (req, res, next) => {
  const newReview = await Review.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { review: newReview }
  });
});

// ✅ Update a review (only if user owns it or admin)
export const updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findOne({ _id: req.params.id, user: req.user.id });

  if (!review) return next(new AppError('You are not allowed to update this review', 403));

  Object.assign(review, req.body);
  await review.save();

  res.status(200).json({
    status: 'success',
    data: { review }
  });
});

// ✅ Delete a review (only if user owns it or admin)
export const deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user.id });

  if (!review) return next(new AppError('You are not allowed to delete this review', 403));

  res.status(204).json({
    status: 'success',
    data: null
  });
});
