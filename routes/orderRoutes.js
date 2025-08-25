import express from 'express';
import {
  placeOrder,
  estimateDeliveryFee,
  getMyOrders,
  updateOrderStatus,
  getCurrentOrders,
  getCookedOrders,
  getAvailableCookedOrders,
  getAvailableCookedOrdersCount,
  getOrdersByRestaurantId,
  chapaWebhook,
  verifyOrderDelivery,
} from '../controllers/orderController.js';
import { protect } from '../controllers/authController.js'; // Auth middleware (JWT)

const router = express.Router();

// Order creation and payment
router.post('/place-order', protect, placeOrder);
router.post('/estimate-delivery-fee', protect, estimateDeliveryFee);

// User-specific order retrieval
router.get('/my-orders', protect, getMyOrders);
router.get('/current', protect, getCurrentOrders);

// Order status and delivery
router.patch('/:orderId/status', protect, updateOrderStatus);
router.post('/verify-delivery', protect, verifyOrderDelivery);

// Restaurant and cooked orders
router.get('/restaurant/:restaurantId/orders', protect, getOrdersByRestaurantId);
router.get('/cooked', protect, getCookedOrders);
router.get('/available-cooked', protect, getAvailableCookedOrders); // For delivery apps
router.get('/available-cooked/count', protect, getAvailableCookedOrdersCount); // Count for delivery apps

// Payment webhook
router.post('/chapa-webhook', chapaWebhook);
router.get("/chapa-webhook", chapaWebhook);

export default router;