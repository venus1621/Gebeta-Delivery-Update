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
  acceptOrder,
  pickUpOrder,
  getOrdersByDeliveryMan
} from '../controllers/orderController.js';
import { protect } from '../controllers/authController.js'; // Auth middleware (JWT)

const router = express.Router();

// Payment webhook - MUST be before dynamic routes
router.post('/chapa-webhook', chapaWebhook);
router.get("/chapa-webhook", chapaWebhook);

// Order creation and payment
router.post('/place-order', protect, placeOrder);
router.post('/estimate-delivery-fee', protect, estimateDeliveryFee);

// User-specific order retrieval
router.get('/my-orders', protect, getMyOrders);
router.get('/current', protect, getCurrentOrders);

router.post('/accept-for-delivery', protect, acceptOrder);
// Order status and delivery
router.patch('/:orderId/status', protect, updateOrderStatus);
router.post('/verify-delivery', protect, verifyOrderDelivery);
router.post('/verify-restaurant-pickup', protect, pickUpOrder);

// Restaurant and cooked orders
router.get('/restaurant/:restaurantId/orders', protect, getOrdersByRestaurantId);
router.get('/cooked', protect, getCookedOrders);
router.get('/available-cooked', protect, getAvailableCookedOrders); // For delivery apps
router.get('/available-cooked/count', protect, getAvailableCookedOrdersCount); // Count for delivery apps

router.get("/get-orders-by-DeliveryMan", protect, getOrdersByDeliveryMan);

export default router;