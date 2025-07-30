import express from 'express';
import { placeOrder, getMyOrders, updateOrderStatus,getCurrentOrders ,getCookedOrders,getOrdersByRestaurantId} from '../controllers/orderController.js';
import { protect } from '../controllers/authController.js'; // Auth middleware (JWT)

const router = express.Router();

router.post('/place-order', protect, placeOrder);
router.get('/my-orders', protect, getMyOrders);
router.patch('/:orderId/status', protect, updateOrderStatus);
router.get('/current', protect, getCurrentOrders);
router.get('/cooked', protect, getCookedOrders);
router.get('/restaurant/:restaurantId/orders', getOrdersByRestaurantId);
export default router;
