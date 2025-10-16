import Rating from '../models/Rating.js';
import catchAsync from '../utils/catchAsync.js';

export const createRating = catchAsync(async (req, res) => {
  const { comment, rating, restaurant } = req.body;

  // Validate input
  if (!rating || !restaurant) {
    res.status(400);
    throw new Error('Rating and restaurant ID are required');
  }

  // Create new rating
  const newRating = await Rating.create({
    comment,
    rating,
    restaurant,
    user: req.user._id
  });

  // Populate user details
  await newRating.populate('user', 'firstName lastName email');

  res.status(201).json({
    success: true,
    data: newRating
  });
});