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
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Initialize Chapa Direct Charge payment
// export const initializeChapaPayment = async ({ amount, currency, mobile, orderId, payment_method, user, useHostedCheckout = false }) => {
//   const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
//   if (!chapaSecretKey) throw new Error('CHAPA_SECRET_KEY is not configured');

//   if (!amount || !currency || !orderId || !payment_method) {
//     throw new Error('Missing required parameters: amount, currency, orderId, and payment_method are required.');
//   }

//   if (useHostedCheckout && (!user?.email || !user?.firstName || !user?.lastName)) {
//     throw new Error('User email, first name, and last name are required for hosted checkout.');
//   }

//   const txRef = `order-${orderId.toString()}`;
//   let chapaApiUrl;
//   let payload;

//   if (useHostedCheckout) {
//     // Use Hosted Checkout API
//     chapaApiUrl = 'https://api.chapa.co/v1/hosted/initialize';
//     payload = {
//       amount: amount.toString(),
//       currency,
//       email: user.email,
//       first_name: user.firstName,
//       last_name: user.lastName,
//       tx_ref: txRef,
//       callback_url: 'https://gebeta-delivery1.onrender.com/api/v1/orders/chapaWebhook',
//       return_url: 'https://your-app.com/payment-success', // Replace with your frontend success page
//       customization: {
//         title: 'Order Payment',
//         description: `Payment for order ${txRef}`,
//       },
//     };
//   } else {
//     // Use Direct Charge API (existing logic)
//     if (!mobile) {
//       throw new Error('Mobile number is required for direct charge.');
//     }
//     chapaApiUrl = `https://api.chapa.co/v1/charges?type=${payment_method}`;
//     payload = {
//       amount: amount.toString(),
//       currency,
//       mobile,
//       tx_ref: txRef,
//       callback_url: 'https://gebeta-delivery1.onrender.com/api/v1/orders/chapaWebhook',
//     };
//   }

//   const response = await axios.post(
//     chapaApiUrl,
//     payload,
//     {
//       headers: {
//         Authorization: `Bearer ${chapaSecretKey}`,
//         'Content-Type': 'application/json',
//       },
//       timeout: 15000,
//     }
//   );

//   if (!response?.data || response.data.status !== 'success') {
//     const message = response?.data?.message || 'Unknown error';
//     throw new Error(`Failed to initialize Chapa payment: ${message}`);
//   }

//   return {
//     tx_ref: txRef,
//     provider_response: response.data.data,
//     checkout_url: useHostedCheckout ? response.data.data.checkout_url : null, // Return checkout_url for hosted checkout
//   };
// };

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
  const durationInSeconds = osrmResponse?.data?.routes?.[0]?.duration;
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

  return { deliveryFee, distanceKm,durationInSeconds, distanceInMeters, rate: selectedRate, destination: destinationLocation };
};

const initializeChapaPayment = async ({ amount, currency, orderId, user }) => {
  const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
  if (!chapaSecretKey) throw new Error("CHAPA_SECRET_KEY is not configured");

  if (!amount || !currency || !orderId) {
    throw new Error("amount, currency, and orderId are required.");
  }

  if (!user?.firstName || !user?.lastName) {
    throw new Error("User first name and last name are required.");
  }

  // Unique transaction reference for the order
  const txRef = `order-${orderId}`;

  // Chapa API endpoint
  const chapaApiUrl = "https://api.chapa.co/v1/transaction/initialize";

  // Payload to send to Chapa
  const requestPayload = {
    amount: amount.toString(),
    currency,
    first_name: user.firstName,
    mobile: user.phone || "N/A",
    tx_ref: txRef,
    callback_url: "https://gebeta-delivery1.onrender.com/api/v1/orders/chapa-webhook",
    // return_url:"https://your-app.com/payment-success", // Replace with your frontend success page
    customization: {
      title: "Order Payment",
      description: `Payment for order ${txRef}`,
    },
  };

  // Send request to Chapa
  const response = await axios.post(chapaApiUrl, requestPayload, {
    headers: {
      Authorization: `Bearer ${chapaSecretKey}`,
      "Content-Type": "application/json",
    },
    timeout: 35000,
  });

  // Check success
  if (!response?.data || response.data.status !== "success") {
    throw new Error(`Chapa payment initialization failed: ${response?.data?.message || "Unknown error"}`);
  }
  // Return checkout URL
  return {
    tx_ref: txRef,
    checkout_url: response.data.data.checkout_url,
  };
};

export const placeOrder = async (req, res, next) => {
  try {
    // Log environment variables for debugging
    console.log('Environment check:', {
      CHAPA_SECRET_KEY: process.env.CHAPA_SECRET_KEY ? 'Configured' : 'Not configured',
      NODE_ENV: process.env.NODE_ENV,
      DATABASE: process.env.DATABASE ? 'Configured' : 'Not configured'
    });

    const { orderItems, typeOfOrder, vehicleType, destinationLocation, tip ,description} = req.body;
    const userId = req.user._id;

    if (!orderItems || orderItems.length === 0 || !typeOfOrder) {
      return res.status(400).json({ error: { message: 'No order items or type of order provided.' } });
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
      description,
      deliveryVehicle: vehicleType || null,
      restaurant_id,
      location: typeOfOrder === 'Delivery' ? destinationLocation : null,
      order_id: null,
      verification_code: null,
      transaction: {
        Total_Price: totalPrice.toString(),
        Status: 'Pending',
      },
    });

    // Validate user information for Chapa Hosted Checkout
    const user = await User.findById(userId);
    if (!user.firstName || !user.lastName || !user.email) {
      return res.status(400).json({
        error: { message: 'User first name, last name, and email are required for payment processing.' },
      });
    }

    console.log(`Placing order for user: ${user.firstName} (${user.email}) with total price: ${totalPrice}`);

    // Initialize Chapa payment (Hosted Checkout)
    console.log('Initializing Chapa payment...');
    const paymentInit = await initializeChapaPayment({
      amount: totalPrice,
      currency: 'ETB',
      orderId: order._id,
      user,
    });
    
    

    res.status(201).json({
      status: 'success',
      data: {
       
        payment: paymentInit,
        // summary: {
        //   foodTotal,
        //   deliveryFee,
        //   tip: tipAmount,
        //   totalPrice,
        //   vehicleType: vehicleType || null,
        //   distanceKm: computedDistanceKm,
        // },
      },
    });
  } catch (error) {
    console.error('Error placing order:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log additional error details for debugging
    if (error.response) {
      console.error('Error response details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    }
    
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId, status } = req.body;
    const allowedStatuses = ['Pending', 'Preparing', 'Cooked', 'Delivering', 'Completed', 'Cancelled'];

    if (!orderId || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: {
          message:
            'Valid orderId and status (Pending, Preparing, Cooked, Delivering, Completed, Cancelled) are required.',
        },
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: { message: 'Order not found.' } });
    }

    order.orderStatus = status;
    await order.save();

    // 🔹 Only broadcast when the order is cooked and requires delivery
    if (status === 'Cooked' && order.typeOfOrder === 'Delivery') {
      const restaurant = await Restaurant.findById(order.restaurant_id);
      if (!restaurant) {
        console.warn(`Restaurant not found for order ${order._id}, skipping delivery notification.`);
      } else {
        const restaurantLocation = {
          lat: restaurant.location.coordinates[1],
          lng: restaurant.location.coordinates[0],
        };

        const deliveryLocation = order.location;

        // 🔹 Calculate grand total = food total + delivery fee + tip
        const grandTotal = Number(order.deliveryFee) + Number(order.tip || 0);

        const io = getIO();
        if (!io) {
          console.warn('Socket.IO not initialized, skipping delivery notification.');
        } else {
          io.to('deliveries').emit('order:cooked', {
            orderId: order._id,
            order_id: order.order_id,
            restaurantLocation,
            restaurant_name: restaurant.name,
            deliveryLocation,
            deliveryFee: order.deliveryFee,
            tip: order.tip,
            grandTotal,
            createdAt: order.createdAt,
          });
          
          // Also broadcast updated count of available orders
          try {
            const availableCount = await Order.countDocuments({ 
              orderStatus: 'Cooked', 
              typeOfOrder: 'Delivery',
              deliveryId: { $exists: false }
            });
            io.to('deliveries').emit('available-orders-count', { count: availableCount });
          } catch (countError) {
            console.warn('Failed to broadcast available orders count:', countError);
          }
          
          console.log(`✅ Broadcasted cooked order notification for order ${order._id}`);
        }
      }
    }

    res.status(200).json({
      status: 'success',
      message: `Order status updated to ${status}.`,
    });
  } catch (error) {
    console.error('Error updating order status:', error.message);
    next(error);
  }
};

export const chapaWebhook = async (req, res) => {
  try {
    const { trx_ref, ref_id, status } = req.query;

    console.log("Webhook received:", { trx_ref, ref_id, status });

    // 1. Verify with Chapa (optional but safer)
    const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
    const verifyUrl = `https://api.chapa.co/v1/transaction/verify/${trx_ref}`;

    const verifyRes = await axios.get(verifyUrl, {
      headers: { Authorization: `Bearer ${chapaSecretKey}` },
    });

    if (verifyRes.data.status !== "success") {
      return res.status(400).json({ message: "Verification failed" });
    }

    // 2. Find order
    const orderId = trx_ref.replace("order-", "");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 3. Update order payment status
    order.transaction.Status = status === "success" ? "Paid" : "Failed";
    order.transaction.ref_id = ref_id;
    order.order_id = await generateOrderId();
    order.verification_code = generateVerificationCode();
    await order.save();

    console.log("Order updated successfully:", order._id);

    // 4. Respond OK to Chapa
    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(500).json({ message: "Server error processing webhook" });
  }
};

export const verifyOrderDelivery = async (req, res, next) => {
  try {
    const { order_id, verification_code } = req.body;
    const deliveryPersonId = req.user._id;

    if (!order_id || !verification_code) {
      return res.status(400).json({
        error: { message: "Order ID and verification code are required." },
      });
    }

    // 🔹 Find order by custom order_id (not Mongo _id)
    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({ error: { message: "Order not found." } });
    }

    if (order.orderStatus !== "Delivering") {
      return res.status(400).json({
        error: { message: "Order must be in Delivering status to verify delivery." },
      });
    }

    if (order.verification_code !== verification_code) {
      return res.status(400).json({ error: { message: "Invalid verification code." } });
    }

    // if (order.deliveryId && order.deliveryId.toString() !== deliveryPersonId.toString()) {
    //   return res.status(403).json({
    //     error: { message: "Only the assigned delivery person can verify this order." },
    //   });
    // }

    // ✅ Update order to completed
    order.orderStatus = "Completed";
    order.verification_code = null; // Clear verification code after use
    await order.save();

    res.status(200).json({
      status: "success",
      data: { order },
      message: "Order delivery verified successfully.",
    });
  } catch (error) {
    console.error("Error verifying order delivery:", error.message);
    next(error);
  }
};

export const pickUpOrder = async (req, res) => {
  try {
    const { order_id, deliveryVerificationCode } = req.body;
    const deliveryPersonId = req.user._id; // from auth middleware (JWT)

    // Validate input
    if (!order_id || !deliveryVerificationCode) {
      return res.status(400).json({
        error: { message: "Order ID and delivery verification code are required." },
      });
    }

    // Find order by custom order_id field
    const order = await Order.findOne({ order_id });
    if (!order || order.typeOfOrder !== "Delivery" ) {
      return res.status(404).json({
        error: { message: "Order not found." },
      });
    }

    if(order.orderStatus==='Delivering' ){
      return res.status(400).json({
        error: { message: "Order has already been picked up." },
      }); 
    }
    // Check verification code
    if (order.deliveryVerificationCode !== deliveryVerificationCode) {
      return res.status(400).json({
        error: { message: "Invalid delivery verification code." },
      });
    }

    // ✅ Update order status to Delivering
    order.orderStatus = "Delivering";
    order.deliveryId = deliveryPersonId; // link delivery person
    order.pickedUpAt = new Date();

    await order.save();

    return res.status(200).json({
      status: "success",
      message: "Order status updated to Delivering.",
      order,
    });
  } catch (err) {
    console.error("Pickup Error:", err);
    res.status(500).json({
      error: { message: "Something went wrong while picking up the order." },
    });
  }
};


export const getOrdersByRestaurantId = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return next(new AppError('Restaurant ID is required', 400));
    }

    // 🔹 Query with conditions: Paid transactions + allowed order statuses
    const orders = await Order.find({
      restaurant_id: restaurantId,
      'transaction.Status': 'Paid',
    
    })
      .populate('userId', 'firstName phone')
      .populate('orderItems.foodId', 'foodName price ')
      .sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No matching orders found for this restaurant',
      });
    }

    // 🔹 Format response
    const formattedOrders = orders.map(order => {
      const totalFoodPrice = order.orderItems.reduce((sum, item) => {
        const price = item.foodId?.price || 0;
        return sum + price * item.quantity;
      }, 0);

      return {
        userName: order.userId?.firstName,
        phone: order.userId?.phone,
        items: order.orderItems.map(item => ({
          foodName: item.foodId?.foodName,
          quantity: item.quantity,
          price: item.foodId?.price,
        })),
       
        totalFoodPrice,
        orderDate: order.createdAt,
        orderType: order.typeOfOrder,
        orderStatus: order.orderStatus,
        orderId: order._id,
        orderCode: order.order_id,
        description:order.description,
        deloveryVerification: order.deliveryVerificationCode 
      };
    });

    res.status(200).json({
      status: 'success',
      results: formattedOrders.length,
      data: formattedOrders,
    });
  } catch (error) {
    next(error);
  }
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


export const acceptOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const deliveryPersonId = req.user._id;

    // Validate input
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required.' });
    }

    // Check if delivery person already has an active order
    const existingOrder = await Order.findOne({
      deliveryId: deliveryPersonId,
      orderStatus: { $nin: ['Completed', 'Cancelled'] }, // still active
    });

    if (existingOrder) {
      return res.status(400).json({
        error:
          'You already have an active order. Complete or cancel it before accepting a new one.',
        activeOrder: {
          orderId: existingOrder._id,
          status: existingOrder.orderStatus,
        },
      });
    }

    // Find and update the new order atomically
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        orderStatus: 'Cooked',
        typeOfOrder: 'Delivery',
        deliveryId: { $exists: false },
      },
      {
        deliveryId: deliveryPersonId,
        deliveryVerificationCode: generateVerificationCode(),
      },
      { new: true }
    );

    if (!order) {
      return res
        .status(400)
        .json({ error: 'Order is not available for acceptance.' });
    }

    res.status(200).json({
      status: 'success',
      message: `Order ${order.order_id} accepted.`,
      data: {
        orderCode: order.order_id,
        pickUpVerification: order.deliveryVerificationCode,
      },
    });
  } catch (error) {
    console.error('Error accepting order:', error.message);
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

export const getCookedOrders = async (req, res, next) => {
  try {
    const cookedOrders = await Order.find({ 
      orderStatus: 'Cooked',
      deliveryId: { $exists: false } // Exclude orders that already have deliveryId
    })
      .populate('userId', 'phone') // only populate phone number
      .populate('restaurant_id', 'name location') // only populate name and location
      .sort({ updatedAt: -1 });

    // Map the response to include only desired fields
    const formattedOrders = cookedOrders.map(order => ({
      userPhone: order.userId?.phone,
      orderId: order._id,
      restaurant: {
        name: order.restaurant_id?.name,
        location: order.restaurant_id?.location
      },
      orderLocation: order.location,
      deliveryFee: order.deliveryFee,
      tip: order.tip,
      totalPrice: order.totalPrice,
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

// Get all available cooked orders (without delivery assignment) for delivery app
export const getAvailableCookedOrders = async (req, res, next) => {
  try {
    const availableOrders = await Order.find({ 
      orderStatus: 'Cooked', 
      typeOfOrder: 'Delivery',
      deliveryId: { $exists: false } // No delivery person assigned yet
    })
      .populate('userId', 'firstName lastName phone')
      .populate('restaurant_id', 'name location')
      .populate('orderItems.foodId', 'foodName price')
      .sort({ createdAt: 1 }); // Oldest first (FIFO)

    const formattedOrders = availableOrders.map(order => ({
      orderId: order._id,
      order_id: order.order_id,
      restaurantLocation: {
        lat: order.restaurant_id?.location?.coordinates?.[1] || 0,
        lng: order.restaurant_id?.location?.coordinates?.[0] || 0,
      },
      deliveryLocation: order.location,
      deliveryFee: order.deliveryFee,
      tip: order.tip,
      grandTotal: order.totalPrice,
      createdAt: order.createdAt,
      customer: {
        name: `${order.userId?.firstName || ''} ${order.userId?.lastName || ''}`.trim(),
        phone: order.userId?.phone,
      },
      items: order.orderItems.map(item => ({
        foodName: item.foodId?.foodName,
        price: item.foodId?.price,
        quantity: item.quantity,
      })),
    }));

    res.status(200).json({
      status: 'success',
      results: formattedOrders.length,
      data: formattedOrders
    });
  } catch (error) {
    console.error('Error fetching available cooked orders:', error.message);
    res.status(500).json({ message: 'Server error retrieving available cooked orders' });
  }
};

// Get count of available cooked orders for delivery apps
export const getAvailableCookedOrdersCount = async (req, res, next) => {
  try {
    const count = await Order.countDocuments({ 
      orderStatus: 'Cooked', 
      typeOfOrder: 'Delivery',
      deliveryId: { $exists: false }
    });

    res.status(200).json({
      status: 'success',
      data: { count }
    });
  } catch (error) {
    console.error('Error counting available cooked orders:', error.message);
    res.status(500).json({ message: 'Server error counting available cooked orders' });
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

    const allowedVehicles = ['Car', 'Motor', 'Bicycle'];
    if (!allowedVehicles.includes((vehicleType || '').toString())) {
      return res.status(400).json({ message: 'vehicleType must be one of Car, Motor, Bicycle.' });
    }

    const { deliveryFee, distanceKm, distanceInMeters,durationInSeconds } = await computeDeliveryFee({
      restaurantLocation,
      destinationLocation: destination,
      address,
      vehicleType,
    });
  
    return res.status(200).json({
      status: 'success',
      data: {
        deliveryFee,
        distanceKm,
        distanceInMeters,
        durationInSeconds,
        vehicleType,
      },
    });
  } catch (err) {
    return res.status(400).json({ status: 'fail', message: err.message });
  }
};
export const getOrdersByDeliveryMan = async (req, res, next) => {
  
  try {
    const deliveryPersonId = req.user._id; // from auth middleware 
    console.log('Fetching orders for delivery person:', deliveryPersonId);
    // Find all orders assigned to this delivery person
    const orders = await Order.findOne({
      deliveryId: deliveryPersonId,
    })
      .populate('userId', 'phone') // only phone
      .populate('restaurant_id', 'name location') // only name and location
      .sort({ updatedAt: -1 });
    
    // // Format to match cookedOrders style
    // const formattedOrders = orders.map(order => ({
    //   userPhone: order.userId?.phone,
    //   orderId: order._id,
    //   restaurant: {
    //     name: order.restaurant_id?.name,
    //     location: order.restaurant_id?.location,
    //   },
    //   orderLocation: order.location,
    //   deliveryFee: order.deliveryFee,
    //   tip: order.tip,
    //   totalPrice: order.totalPrice,
    //   orderStatus: order.orderStatus,
    //   verificationCode: order.deliveryVerificationCode,
    //   orderCode: order.orderCode,
    // }));

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching delivery man orders:', error.message);
    res.status(500).json({ message: 'Server error retrieving delivery orders' });
  }
};
