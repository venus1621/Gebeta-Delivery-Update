import express from 'express';
import {
  createTransaction,
  updateTransactionStatus,
  getTransaction,
  getAllTransactions,

} from '../controllers/transactionController.js';
import { protect } from '../controllers/authController.js';

const router = express.Router();
// Admin or authorized user updates another user's location

router.post('/', protect, createTransaction);
router.patch('/:transactionId/status', protect, updateTransactionStatus);
router.get('/:transactionId', protect, getTransaction);
router.get('/', protect, getAllTransactions); // Optional for Admin

export default router;
