import express from 'express';
import {
  createDelivery,
  assignDeliveryToOrder,
  getAllDeliveries,
  getDelivery,
  updateDelivery,
  deleteDelivery,
  cancelDeliveryAssignment
} from '../controllers/deliverController.js';
import { protect, restrictTo } from '../controllers/authController.js';
const router = express.Router();

router.route('/')
  .post(protect,assignDeliveryToOrder)
  .get(getAllDeliveries);
router.route('/cancel')
  .post(protect, cancelDeliveryAssignment); 
router.route('/:id')
  .get(getDelivery)
  .patch(updateDelivery)
  .delete(deleteDelivery);

export default router;
