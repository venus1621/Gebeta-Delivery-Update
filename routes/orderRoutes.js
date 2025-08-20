import express from 'express';
import axios from 'axios';
import {
  placeOrder,
  estimateDeliveryFee,
  getMyOrders,
  updateOrderStatus,
  getCurrentOrders,
  getCookedOrders,
  getOrdersByRestaurantId,
  chapaWebhook,
  verifyOrderDelivery,
  initializeChapaPayment
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

// Payment webhook
router.post('/chapa-webhook', chapaWebhook);
router.post('/initializechapa',initializeChapaPayment);

// Test endpoint to verify Chapa API connection
router.get('/test-chapa', protect, async (req, res) => {
  try {
    const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
    if (!chapaSecretKey) {
      return res.status(500).json({ error: 'CHAPA_SECRET_KEY not configured' });
    }
    
    // Test basic connection to Chapa API
    const response = await axios.get('https://api.chapa.co/v1/account', {
      headers: {
        Authorization: `Bearer ${chapaSecretKey}`,
      },
      timeout: 10000,
    });
    
    res.json({ 
      status: 'success', 
      message: 'Chapa API connection successful',
      accountInfo: response.data 
    });
  } catch (error) {
    console.error('Chapa API test failed:', error.message);
    res.status(500).json({ 
      error: 'Chapa API connection failed', 
      details: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
  }
});

export default router;