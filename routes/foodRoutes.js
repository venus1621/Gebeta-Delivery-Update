import express from 'express';
import {
  createFood,
  getAllFood,
  getFood,
  updateFood,
  deleteFood
} from '../controllers/foodController.js';

const router = express.Router();

router.route('/')
  .get(getAllFood)
  .post(createFood);

router.route('/:id')
  .get(getFood)
  .patch(updateFood)
  .delete(deleteFood);

export default router;
