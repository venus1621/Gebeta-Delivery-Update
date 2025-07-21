import Order from '../models/Order.js';
import Food from '../models/Food.js';
import FoodMenu from '../models/FoodMenu.js';


export const placeOrder = async (req, res, next) => {
  try {
    const { orderItems, typeOfOrder } = req.body;
    const userId = req.user._id;

    if (!orderItems || orderItems.length === 0 || !typeOfOrder) {
      return res.status(400).json({ message: 'No order items or type of order provided.' });
    }

    let totalPrice = 0;
    let restaurant_id = null;

    // 🔁 Loop through order items to validate and compute total price
    for (const item of orderItems) {
      const food = await Food.findById(item.foodId).populate('menuId');
      if (!food) {
        return res.status(404).json({ message: `Food item not found: ${item.foodId}` });
      }

      const currentRestaurantId = food.menuId.restaurantId.toString();

      // ✅ Ensure all items are from the same restaurant
      if (!restaurant_id) {
       restaurant_id = currentRestaurantId;
       
      } else if (restaurant_id !== currentRestaurantId) {
        return res.status(400).json({ message: 'All items in the order must be from the same restaurant.' });
      }

      totalPrice += food.price * item.quantity;
    }

    // ✅ Create order with validated restaurant ID
    const order = await Order.create({
      userId,
      orderItems,
      totalPrice,
      typeOfOrder,
      restaurant_id,
      transaction: {
        Total_Price: totalPrice,
        Status: 'Pending',
      },
    });

    res.status(201).json({
      status: 'success',
      data: { order },
    });

  } catch (error) {
    console.error('Error placing order:', error);
    next(error);
  }
};





// Get my Orders
export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .populate('orderItems.foodId');

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: { orders },
    });
  } catch (error) {
    console.error('Error getting orders:', error);
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

    // Optional: mark transaction as paid when completed
    if (status === 'Completed') {
      order.transaction.Status = 'Paid';
    }

    await order.save();

    res.status(200).json({
      status: 'success',
      data: { order },
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    next(error);
  }
};

