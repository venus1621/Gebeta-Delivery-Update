import express from 'express';
import {
 createRating
} from '../controllers/ratingController.js';

import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router({ mergeParams: true }); // support nested routes

router
  .post('/', protect, createRating);

export default router;
