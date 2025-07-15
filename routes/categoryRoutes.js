import express from 'express';
import * as categoryController from '../controllers/categoryController.js';
import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);

// Protected routes (Admin only)
router.use(protect);
router.post('/', restrictTo('Admin'), categoryController.createCategory);
router.patch('/:id', restrictTo('Admin'), categoryController.updateCategory);
router.delete('/:id', restrictTo('Admin'), categoryController.deleteCategory);

export default router;
