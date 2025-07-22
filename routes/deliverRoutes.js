import express from 'express';
import {
  createDelivery,
  getAllDeliveries,
  getDelivery,
  updateDelivery,
  deleteDelivery
} from '../controllers/deliverController.js';
import { protect, restrictTo } from '../controllers/authController.js';
const router = express.Router();

router.route('/')
  .post(protect,createDelivery)
  .get(getAllDeliveries);

router.route('/:id')
  .get(getDelivery)
  .patch(updateDelivery)
  .delete(deleteDelivery);

export default router;
