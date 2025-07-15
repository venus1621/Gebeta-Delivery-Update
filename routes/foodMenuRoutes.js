import express from 'express';
import {
  createMenu,
  getAllMenus,
  getMenu,
  updateMenu,
  deleteMenu
} from '../controllers/foodMenuController.js';

import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

router
  .route('/')
  .get(getAllMenus)
  .post(protect, restrictTo('Admin', 'Manager'), createMenu);

router
  .route('/:id')
  .get(getMenu)
  .patch(protect, restrictTo('Admin', 'Manager'), updateMenu)
  .delete(protect, restrictTo('Admin', 'Manager'), deleteMenu);

export default router;
