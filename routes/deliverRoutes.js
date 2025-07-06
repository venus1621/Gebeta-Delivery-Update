import express from 'express';
import {
  createDelivery,
  getAllDeliveries,
  getDelivery,
  updateDelivery,
  deleteDelivery
} from '../controllers/deliverController.js';

const router = express.Router();

router.route('/')
  .post(createDelivery)
  .get(getAllDeliveries);

router.route('/:id')
  .get(getDelivery)
  .patch(updateDelivery)
  .delete(deleteDelivery);

export default router;
