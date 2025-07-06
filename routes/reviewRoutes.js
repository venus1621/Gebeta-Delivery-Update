import express from 'express';
import {
  getAllReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  setRestaurantUserIds
} from '../controllers/reviewController.js';

import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router({ mergeParams: true }); // support nested routes

router
  .route('/')
  .get(getAllReviews)
  .post(protect, setRestaurantUserIds, createReview);

router
  .route('/:id')
  .get(getReview)
  .patch(protect, updateReview)
  .delete(protect, deleteReview);

export default router;
