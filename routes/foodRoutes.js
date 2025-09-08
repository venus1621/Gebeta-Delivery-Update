import express from 'express';
import {
  createFood,
  getAllFoods,
  getFood,
  updateFood,
  deleteFood,
  uploadFoodImageToCloudinary,
  getFoodsByMenuId
} from '../controllers/foodController.js';

import { protect, restrictTo } from '../controllers/authController.js';
import { upload } from '../utils/uploadFoodImage.js'; // your multer setup

const router = express.Router();

router
  .route('/')
  .get(getAllFoods)
  .post(
    protect,
    restrictTo('Admin', 'Manager'),
    upload.single('image'),
    uploadFoodImageToCloudinary,
    createFood
  );
router.get('/by-menu/:menuId', getFoodsByMenuId);
router
  .route('/:id')
  .get(getFood)
  .patch(
    protect,
    restrictTo('Admin', 'Manager'),
    upload.single('image'),
    uploadFoodImageToCloudinary,
    updateFood
  )
  .delete(protect, restrictTo('Admin', 'Manager'), deleteFood);

export default router;
 