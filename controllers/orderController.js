import Order from '../models/Order.js';
import Food from '../models/Food.js';
import Restaurant from '../models/restaurantModel.js';
import axios from 'axios';

export const placeOrder = async (req, res, next) => {
  try {
    const { orderItems, typeOfOrder, location } = req.body;
    const userId = req.user._id;
   
    if (!orderItems || orderItems.length === 0 || !typeOfOrder) {
      return res.status(400).json({ message: 'No order items or type of order provided.' });
    }

    let foodTotal = 0;
    let restaurant_id = null;
    let restaurantLocation = null;

    // 🔁 Loop to validate items and compute food total
    for (const item of orderItems) {
      const food = await Food.findById(item.foodId).populate('menuId');
      if (!food) {
        return res.status(404).json({ message: `Food item not found: ${item.foodId}` });
      }

      const currentRestaurantId = food.menuId.restaurantId.toString();
     
    const restant = await Restaurant.findById(currentRestaurantId);
     const currentRestaurantLocation = {
        lat: restant.location.coordinates[1],
        lng: restant.location.coordinates[0]
      };
      
      if (!restaurant_id) {
        restaurant_id = currentRestaurantId;
        restaurantLocation = currentRestaurantLocation;
      } else if (restaurant_id !== currentRestaurantId) {
        return res.status(400).json({ message: 'All items must be from the same restaurant.' });
      }

      foodTotal += food.price * item.quantity;
    }

    // 🛵 If delivery, validate and calculate delivery fee
    let deliveryFee = 0;
    if (typeOfOrder === 'Delivery') {
      if (!location?.lat || !location?.lng) {
        return res.status(400).json({ message: 'Delivery location is required.' });
      }

      console.log(restaurantLocation);
      console.log(location);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${location.lng},${location.lat};${restaurantLocation.lng},${restaurantLocation.lat}?overview=false`;
      const osrmResponse = await axios.get(osrmUrl);
      const distanceInMeters = osrmResponse?.data?.routes?.[0]?.distance;

      if (!distanceInMeters) {
        return res.status(500).json({ message: 'Failed to calculate delivery distance.' });
      }

      deliveryFee = Math.ceil((distanceInMeters / 100) * 50); // 50 Birr per 100m
    }

    const totalPrice = foodTotal + deliveryFee;

    // ✅ Create order
    const order = await Order.create({
      userId,
      orderItems,
      foodTotal,
      deliveryFee,
      totalPrice,
      typeOfOrder,
      restaurant_id,
      location: typeOfOrder === 'Delivery' ? location : null,
      transaction: {
        Total_Price: totalPrice,
        Status: 'Pending',
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        order,
        summary: {
          foodTotal,
          deliveryFee,
          totalPrice
        }
      }
    });

  } catch (error) {
    console.error('Error placing order:', error.message);
    next(error);
  }
};




export const getOrdersByRestaurantId = async (req, res, next) => {
  const { restaurantId } = req.params;

  if (!restaurantId) {
    return next(new AppError('Restaurant ID is required', 400));
  }

  const orders = await Order.find({ restaurant_id: restaurantId })
    .populate('userId', 'firstName lastName phone status')
    .populate('orderItems.foodId', 'foodName price imageCover')
    .populate('deliveryId', 'deliveryType ')
    .sort({ createdAt: -1 });

  if (!orders || orders.length === 0) {
    return res.status(404).json({
      status: 'fail',
      message: 'No orders found for this restaurant',
    });
  }

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: orders,
  });
};

// Get my Orders
export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .populate('orderItems.foodId')
      .populate('restaurant_id', 'name location');
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
// export const updateOrderStatus = async (req, res, next) => {
//   try {
//     const { orderId } = req.params;
//     const { status } = req.body;

//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({ message: 'Order not found' });
//     }

//     order.orderStatus = status;

//     // Optional: mark transaction as paid when completed
//     if (status === 'Completed') {
//       order.transaction.Status = 'Paid';
//     }

//     await order.save();

//     res.status(200).json({
//       status: 'success',
//       data: { order },
//     });
//   } catch (error) {
//     console.error('Error updating order status:', error);
//     next(error);
//   }
// };
export const getCurrentOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.find({
      userId,
      orderStatus: { $ne: 'Completed' }, // Not Completed
    })
      .populate('orderItems.foodId', 'name price') // Optional: populate food info
      .populate('restaurant_id', 'name location') // Optional: populate restaurant info
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch current orders',
      error: error.message,
    });
  }
};


 // Adjust the path based on your project structure

// 🔁 PATCH /api/orders/:orderId/status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { newStatus } = req.body;

    // ✅ Define valid statuses
    const validStatuses = ['Pending', 'Preparing', 'Cooked', 'Delivering', 'Completed', 'Cancelled'];

    // ❌ Validate status
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }

    // 🔍 Find and update order
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { orderStatus: newStatus },
      { new: true } // return the updated doc
    );

    // ❌ Order not found
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // ✅ Return updated order
    res.status(200).json({
      message: 'Order status updated successfully.',
      order: updatedOrder,
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};


export const getCookedOrders = async (req, res, next) => {
  try {
    const cookedOrders = await Order.find({ orderStatus: 'Cooked' })
      .populate('userId', 'phone') // only populate phone number
      .populate('restaurant_id', 'name location') // only populate name and location
      .sort({ updatedAt: -1 });

    // Map the response to include only desired fields
    const formattedOrders = cookedOrders.map(order => ({
      userPhone: order.userId?.phone,
      restaurant: {
        name: order.restaurant_id?.name,
        location: order.restaurant_id?.location
      },
      orderLocation: order.location
    }));

    res.status(200).json({
      status: 'success',
      results: formattedOrders.length,
      data: formattedOrders
    });
  } catch (error) {
    console.error('Error fetching cooked orders:', error.message);
    res.status(500).json({ message: 'Server error retrieving cooked orders' });
  }
};
