import express from 'express';
import multer from 'multer';
import { protect, restrictTo } from '../controllers/authController.js';
import * as restaurantController from '../controllers/restaurantController.js';
import  uploadRestaurantImage  from '../middleware/uploadRestaurantImageToCloudinary.js'; // NEW

const router = express.Router();

// Multer config with memoryStorage for Cloudinary
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

// Public routes
router.route('/')
  .get(restaurantController.getAllRestaurants)
  .post(
    protect,
    restrictTo('Manager', 'Admin'),
    upload.single('image'),           // File upload
    uploadRestaurantImage,            // Cloudinary upload
    restaurantController.createRestaurant
  );

router.get('/distance-from-coords', restaurantController.getRestaurantsWithDistanceFromCoords);

router.get(
  '/by-manager/:managerId',
  protect,
  restrictTo('Manager', 'Admin'),
  restaurantController.getRestaurantsByManagerId
);
router.post(
  '/assign-manager',
  protect,
  restrictTo('Admin'),
  restaurantController.assignRestaurantManager
);

router.route('/:id')
  .get(restaurantController.getRestaurant)
  .patch(
    protect,
    restrictTo('Manager', 'Admin'),
    upload.single('image'),           // File upload
    uploadRestaurantImage,            // Cloudinary upload
    restaurantController.updateRestaurant
  )
  .delete(
    protect,
    restrictTo('Manager', 'Admin'),
    restaurantController.deleteRestaurant
  );

export default router;
