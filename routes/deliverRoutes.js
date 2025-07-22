import express from 'express';
import {
  createDelivery,
  assignDeliveryToOrder,
  getAllDeliveries,
  getDelivery,
  updateDelivery,
  deleteDelivery
} from '../controllers/deliverController.js';
import { protect, restrictTo } from '../controllers/authController.js';
const router = express.Router();

router.route('/')
  .post(protect,assignDeliveryToOrder)
  .get(getAllDeliveries);

router.route('/:id')
  .get(getDelivery)
  .patch(updateDelivery)
  .delete(deleteDelivery);

export default router;
