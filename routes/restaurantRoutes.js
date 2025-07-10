// Import necessary packages
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { protect, restrictTo } from '../controllers/authController.js';
import * as restaurantController from '../controllers/restaurantController.js';

const router = express.Router();

// Set up multer for image upload
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

// Resize and compress image
const resizeRestaurantImage = async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `restaurant-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(800, 600)
    .toFormat('jpeg')
    .jpeg({ quality: 60 })
    .toFile(`public/img/restaurants/${req.file.filename}`);

  req.body.image = req.file.filename;
  next();
};

// Public routes
router
  .route('/')
  .get(restaurantController.getAllRestaurants)
  
  .post(
    protect,
    restrictTo('manager', 'admin'),
    upload.single('image'),
    resizeRestaurantImage,
    restaurantController.createRestaurant
  );
  router.get('/distance-from-coords', restaurantController.getRestaurantsWithDistanceFromCoords);

router
  .route('/:id')
  .get(restaurantController.getRestaurant)
  .patch(
    protect,
    restrictTo('manager', 'admin'),
    upload.single('image'),
    resizeRestaurantImage,
    restaurantController.updateRestaurant
  )
  .delete(protect, restrictTo('manager', 'admin'), restaurantController.deleteRestaurant);

export default router;


// import express from 'express';
// import {
//   createRestaurant,
//   getAllRestaurants,
//   getRestaurant,
//   updateRestaurant,
//   deleteRestaurant
// } from '../controllers/restaurantController.js';

// const router = express.Router();

// router.route('/')
//   .get(getAllRestaurants)
//   .post(createRestaurant);

// router.route('/:id')
//   .get(getRestaurant)
//   .patch(updateRestaurant)
//   .delete(deleteRestaurant);

// export default router;
