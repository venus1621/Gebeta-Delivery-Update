import Order from '../models/Order.js';
import Food from '../models/Food.js';
import Transaction from '../models/Transaction.js';

// Place Order
export const placeOrder = async (req, res, next) => {
  try {
    const { orderItems, deliveryAddress } = req.body;
    const { userId } = req.user; // Assuming authentication middleware injects user

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items provided.' });
    }

    let totalPrice = 0;

    for (const item of orderItems) {
      const food = await Food.findById(item.foodId);
      if (!food) {
        return res.status(404).json({ message: `Food item not found: ${item.foodId}` });
      }
      totalPrice += food.price * item.quantity;
    }

    const order = await Order.create({
      userId,
      orderItems,
      deliveryAddress,
      totalPrice,
    });

    const transaction = await Transaction.create({
      cart_id: null,
      Total_Price: totalPrice,
    });

    res.status(201).json({
      status: 'success',
      data: {
        order,
        transaction,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get my Orders
export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user.userId }).populate('orderItems.foodId');
    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
};

// Update Order Status (Admin / Delivery Person)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.orderStatus = status;
    await order.save();

    res.status(200).json({
      status: 'success',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};
