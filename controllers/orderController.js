import Order from '../models/Order.js';
import Food from '../models/Food.js';
import Restaurant from '../models/restaurantModel.js';
import User from '../models/userModel.js';
import axios from 'axios';
import { getIO } from '../utils/socket.js';

// Generate a unique order_id (e.g., ORD-XXXXXX)
const generateOrderId = async () => {
  const prefix = 'ORD';
  const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit number
  const orderId = `${prefix}-${randomNum}`;
  const existingOrder = await Order.findOne({ order_id: orderId });
  if (existingOrder) {
    return generateOrderId(); // Recursively generate until unique
  }
  return orderId;
};

// Generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Initialize Chapa Direct Charge payment
 export const initializeChapaPayment = async ({ amount, currency, mobile, orderId, payment_method }) => {
  const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
  if (!chapaSecretKey) throw new Error('CHAPA_SECRET_KEY is not configured');

  if (!amount || !currency || !mobile || !orderId || !payment_method) {
    throw new Error('Missing required parameters for Chapa Direct Charge: amount, currency, mobile, orderId, and payment_method are required.');
  }

  const chapaApiUrl = `https://api.chapa.co/v1/charges?type=${payment_method}`;
  const txRef = `order-${orderId.toString()}`;

  const response = await axios.post(
    chapaApiUrl,
    {
      amount: amount.toString(),
      currency,
      mobile,
      tx_ref: txRef,
      callback_url: "https://gebeta-delivery1.onrender.com/api/v1/orders/chapaWebhook"    
    },
    {
      headers: {
        Authorization: `Bearer ${chapaSecretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  if (!response?.data || response.data.status !== 'success') {
    const message = response?.data?.message || 'Unknown error';
    throw new Error(`Failed to initialize Chapa charge: ${message}`);
  }

  return {
    tx_ref: txRef,
    provider_response: response.data.data,
  };
};

const computeDeliveryFee = async ({ restaurantLocation, destinationLocation, vehicleType }) => {
  if (!destinationLocation?.lat || !destinationLocation?.lng) {
    throw new Error('Delivery coordinates are required.');
  }

  const origins = `${restaurantLocation.lng},${restaurantLocation.lat}`; // OSRM uses lng,lat
  const destinations = `${destinationLocation.lng},${destinationLocation.lat}`;
  const mode = vehicleType === 'Bicycle' ? 'bike' : 'driving'; // OSRM modes: driving, bike, foot
  const osrmUrl = `https://router.project-osrm.org/route/v1/${mode}/${origins};${destinations}?overview=false`;
  const osrmResponse = await axios.get(osrmUrl);
  const distanceInMeters = osrmResponse?.data?.routes?.[0]?.distance;
  if (!distanceInMeters) {
    throw new Error('Failed to calculate delivery distance.');
  }
  const distanceKm = distanceInMeters / 1000;

  const rateConfig = {
    Car: {
      base: parseFloat(process.env.CAR_BASE_FARE || '150'),
      perKm: parseFloat(process.env.CAR_PER_KM || '13'),
    },
    Motor: {
      base: parseFloat(process.env.MOTOR_BASE_FARE || '100'),
      perKm: parseFloat(process.env.MOTOR_PER_KM || '10'),
    },
    Bicycle: {
      base: parseFloat(process.env.BICYCLE_BASE_FARE || '50'),
      perKm: parseFloat(process.env.BICYCLE_PER_KM || '10'),
    },
  };
  const selectedRate = rateConfig[vehicleType];
  if (!selectedRate) {
    throw new Error('Invalid vehicle type.');
  }
  const rawFee = selectedRate.base + selectedRate.perKm * distanceKm;
  const deliveryFee = Math.ceil(rawFee);

  return { deliveryFee, distanceKm, distanceInMeters, rate: selectedRate, destination: destinationLocation };
};

export const placeOrder = async (req, res, next) => {
  try {
    const { orderItems, typeOfOrder, vehicleType, destinationLocation, tip,payment_method } = req.body;
    const userId = req.user._id;

    if (!orderItems || orderItems.length === 0 || !typeOfOrder || !payment_method) {
      return res.status(400).json({ error: { message: 'No order items, type of order, or payment method provided.' } });
    }

    // Validate payment method
    const allowedPaymentMethods = ['telebirr', 'mpesa', 'cbebirr', 'ebirr', 'enat_bank'];
    if (!allowedPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        error: { message: `payment_method must be one of ${allowedPaymentMethods.join(', ')}.` },
      });
    }

    // Validate tip
    const tipAmount = typeof tip === 'number' && tip >= 0 ? tip : 0;

    let foodTotal = 0;
    let restaurant_id = null;
    let restaurantLocation = null;

    // Validate items and compute food total
    const foodIds = orderItems.map(item => item.foodId);
    const foods = await Food.find({ _id: { $in: foodIds } }).populate('menuId');
    const foodMap = new Map(foods.map(food => [food._id.toString(), food]));

    for (const item of orderItems) {
      const food = foodMap.get(item.foodId.toString());
      if (!food) {
        return res.status(404).json({ error: { message: `Food item not found: ${item.foodId}` } });
      }

      if (!food.menuId?.restaurantId) {
        return res.status(500).json({ error: { message: `Invalid menu data for food item: ${item.foodId}` } });
      }

      const currentRestaurantId = food.menuId.restaurantId.toString();
      const restaurant = await Restaurant.findById(currentRestaurantId);
      const currentRestaurantLocation = {
        lat: restaurant.location.coordinates[1],
        lng: restaurant.location.coordinates[0],
      };

      if (!restaurant_id) {
        restaurant_id = currentRestaurantId;
        restaurantLocation = currentRestaurantLocation;
      } else if (restaurant_id !== currentRestaurantId) {
        return res.status(400).json({ error: { message: 'All items must be from the same restaurant.' } });
      }

      foodTotal += food.price * item.quantity;
    }

    // Calculate delivery fee for delivery orders
    let deliveryFee = 0;
    let computedDistanceKm = 0;

    if (typeOfOrder === 'Delivery') {
      const normalizedVehicle = (vehicleType || '').toString();
      const allowedVehicles = ['Car', 'Motor', 'Bicycle'];
      if (!allowedVehicles.includes(normalizedVehicle)) {
        return res.status(400).json({
          error: { message: `vehicleType must be one of ${allowedVehicles.join(', ')}.` },
        });
      }

      if (!destinationLocation || typeof destinationLocation.lat !== 'number' || typeof destinationLocation.lng !== 'number') {
        return res.status(400).json({ error: { message: 'Valid destination location coordinates are required for delivery.' } });
      }

    

      const { deliveryFee: computedFee, distanceKm } = await computeDeliveryFee({
        restaurantLocation,
        destinationLocation,
        vehicleType: normalizedVehicle,
      });
      deliveryFee = computedFee;
      computedDistanceKm = distanceKm;
    }

    const totalPrice = foodTotal + deliveryFee + tipAmount;

    // Create order
    const order = await Order.create({
      userId,
      orderItems,
      foodTotal,
      deliveryFee,
      tip: tipAmount,
      totalPrice,
      typeOfOrder,
      deliveryVehicle: vehicleType || null,
      restaurant_id,
      location: typeOfOrder === 'Delivery' ? destinationLocation : null,
      order_id: null, // Initialize as null, set when transaction is Paid
      verification_code: null, // Initialize as null, set when transaction is Paid
      transaction: {
        Total_Price: totalPrice.toString(), // Convert to string for Decimal128
        Status: 'Pending',
      },
    });

    // Validate user information for Chapa
    const user = await User.findById(userId);
    if (!user.firstName) {
      return res.status(400).json({
        error: { message: 'User email and first name are required for payment processing.' },
      });
    }
    console.log(`Placing order for user: ${user.firstName} (${user.phone}) with total price: ${totalPrice}`);
    // Initialize Chapa payment
    const paymentInit = await initializeChapaPayment({
      amount: totalPrice,
      currency: 'ETB',
      mobile: user.phone,
      orderId: order._id,
      payment_method,
    });
    

    res.status(201).json({
      status: 'success',
      data: {
        order,
        payment: paymentInit,
        summary: {
          foodTotal,
          deliveryFee,
          tip: tipAmount,
          totalPrice,
          vehicleType: vehicleType || null,
          distanceKm: computedDistanceKm,
        },
      },
    });
  } catch (error) {
    console.error('Error placing order:', error.message);
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId, status } = req.body;
    const allowedStatuses = ['Pending', 'Preparing', 'Cooked', 'Delivering', 'Completed', 'Cancelled'];
    if (!orderId || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: { message: 'Valid orderId and status (Pending, Preparing, Cooked, Delivering, Completed, Cancelled) are required.' },
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: { message: 'Order not found.' } });
    }

    order.orderStatus = status;
    await order.save();

    if (status === 'Cooked' && order.typeOfOrder === 'Delivery') {
      const restaurant = await Restaurant.findById(order.restaurant_id);
      if (!restaurant) {
        console.warn(`Restaurant not found for order ${order._id}, skipping delivery notification.`);
      } else {
        const restaurantLocation = {
          lat: restaurant.location.coordinates[1],
          lng: restaurant.location.coordinates[0],
        };

        const io = getIO();
        if (!io) {
          console.warn('Socket.IO not initialized, skipping delivery notification.');
        } else {
          io.to('deliveries').emit('order:cooked', {
            orderId: order._id,
            order_id: order.order_id,
            restaurantId: order.restaurant_id,
            restaurantLocation,
            destinationLocation: order.location,
            deliveryFee: order.deliveryFee,
            tip: order.tip,
            verification_code: order.verification_code,
            totalPrice: order.totalPrice,
            foodTotal: order.foodTotal,
            createdAt: order.createdAt,
          });
          console.log(`Broadcasted cooked order notification for order ${order._id}`);
        }
      }
    }

    res.status(200).json({
      status: 'success',
      data: { order },
    });
  } catch (error) {
    console.error('Error updating order status:', error.message);
    next(error);
  }
};

export const chapaWebhook = async (req, res, next) => {
  try {
    const { trx_ref, status } = req.body;

    if (!trx_ref || !status) {
      return res.status(400).json({ error: { message: 'Transaction reference and status are required.' } });
    }

    const orderId = trx_ref.replace('order-', '');
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: { message: 'Order not found.' } });
    }

    // Verify transaction with Chapa
    const chapaApiUrl = `https://api.chapa.co/v1/transaction/verify/${trx_ref}`;
    const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
    const response = await axios.get(chapaApiUrl, {
      headers: {
        Authorization: `Bearer ${chapaSecretKey}`,
      },
      timeout: 15000,
    });

    if (response.data.status !== 'success' || response.data.data.status !== 'success') {
      return res.status(400).json({ error: { message: 'Transaction verification failed.' } });
    }

    if (status === 'success' && order.transaction.Status === 'Pending') {
      order.transaction.Status = 'Paid';
      order.order_id = await generateOrderId();
      order.verification_code = generateVerificationCode();
      await order.save();
    }

    res.status(200).json({ status: 'success', message: 'Webhook processed.' });
  } catch (error) {
    console.error('Error processing Chapa webhook:', error.message);
    next(error);
  }
};

export const verifyOrderDelivery = async (req, res, next) => {
  try {
    const { orderId, verification_code } = req.body;
    const deliveryPersonId = req.user._id;

    if (!orderId || !verification_code) {
      return res.status(400).json({
        error: { message: 'Order ID and verification code are required.' },
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: { message: 'Order not found.' } });
    }

    if (order.orderStatus !== 'Delivering') {
      return res.status(400).json({
        error: { message: 'Order must be in Delivering status to verify delivery.' },
      });
    }

    if (order.verification_code !== verification_code) {
      return res.status(400).json({ error: { message: 'Invalid verification code.' } });
    }

    if (order.deliveryId && order.deliveryId.toString() !== deliveryPersonId.toString()) {
      return res.status(403).json({
        error: { message: 'Only the assigned delivery person can verify this order.' },
      });
    }

    order.orderStatus = 'Completed';
    order.verification_code = null; // Clear verification code after use
    await order.save();

    res.status(200).json({
      status: 'success',
      data: { order },
      message: 'Order delivery verified successfully.',
    });
  } catch (error) {
    console.error('Error verifying order delivery:', error.message);
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

// POST /api/v1/orders/estimate-delivery-fee
export const estimateDeliveryFee = async (req, res) => {
  try {
    const { restaurantId, destination, address, vehicleType } = req.body;
    if (!restaurantId) {
      return res.status(400).json({ message: 'restaurantId is required.' });
    }
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant?.location?.coordinates) {
      return res.status(404).json({ message: 'Restaurant location not found.' });
    }
    const restaurantLocation = {
      lat: restaurant.location.coordinates[1],
      lng: restaurant.location.coordinates[0],
    };

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Google Maps API key is missing.' });
    }

    const allowedVehicles = ['Car', 'Motor', 'Bicycle'];
    if (!allowedVehicles.includes((vehicleType || '').toString())) {
      return res.status(400).json({ message: 'vehicleType must be one of Car, Motor, Bicycle.' });
    }

    const { deliveryFee, distanceKm, distanceInMeters } = await computeDeliveryFee({
      restaurantLocation,
      destinationLocation: destination,
      address,
      vehicleType,
      apiKey,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        deliveryFee,
        distanceKm,
        distanceInMeters,
        vehicleType,
      },
    });
  } catch (err) {
    return res.status(400).json({ status: 'fail', message: err.message });
  }
};
