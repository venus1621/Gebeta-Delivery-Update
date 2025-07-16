import Transaction from '../models/Transaction.js';
import Order from '../models/Order.js';

// 🔹 Create Transaction (after Order is created)
export const createTransaction = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const transaction = await Transaction.create({
      orderId,
      Total_Price: order.totalPrice,
    });

    res.status(201).json({
      status: 'success',
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

// 🔹 Update Transaction Status (Paid / Pending)
export const updateTransactionStatus = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    transaction.Status = status;
    await transaction.save();

    if (status === 'Paid') {
      const order = await Order.findById(transaction.orderId);
      if (order) {
        order.paymentStatus = 'Paid';
        await order.save();
      }
    }

    res.status(200).json({
      status: 'success',
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

// 🔹 Get Single Transaction
export const getTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.status(200).json({
      status: 'success',
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

// 🔹 Get All Transactions (Optional, Admin)
export const getAllTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find().populate('orderId');

    res.status(200).json({
      status: 'success',
      results: transactions.length,
      data: { transactions },
    });
  } catch (error) {
    next(error);
  }
};
