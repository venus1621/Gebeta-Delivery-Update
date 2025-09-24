import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Food from '../models/Food.js';
import Restaurant from '../models/restaurantModel.js';
import User from '../models/userModel.js';
import axios from 'axios';
import { getIO } from '../utils/socket.js';
import { computeDeliveryFee } from '../utils/computeDeliveryFee.js';
import {notifyRestaurantManager,notifyDeliveryGroup} from '../server.js';

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
    phone_number: user.phone || "N/A",
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
    const { orderItems, typeOfOrder, vehicleType, destinationLocation, tip, description } = req.body;
    const userId = req.user._id;

    // ✅ Validate & compute with normalized items using the model's static method
    const {
      orderItems: normalizedOrderItems,
      foodTotal,
      restaurantId,
      deliveryFee,
      distanceKm,
      tip: tipAmount,
      restaurantLocation,
      destinationLocation: validatedDestination,
      deliveryVehicle: validatedDeliveryVehicle,
      restaurantName,
      totalPrice,
      typeOfOrder: validatedTypeOfOrder,
      description: validatedDescription,
      orderCode,
      userVerificationCode,
    } = await Order.validateAndComputeOrder({
      orderItems,
      typeOfOrder,
      deliveryVehicle: vehicleType,
      destinationLocation,
      tip,
      description,  
    });
    // --- Create order with normalized items ---
    const order = await Order.create({
      userId,
      orderItems: normalizedOrderItems, // ✅ safe items from model validation
      foodTotal, // Already Decimal128 from model
      deliveryFee, // Already Decimal128 from model
      tip: tipAmount, // Already Decimal128 from model
      totalPrice, // Already Decimal128 from model
      typeOfOrder: validatedTypeOfOrder,
      description: validatedDescription,
      deliveryVehicle: validatedTypeOfOrder === "Delivery" ? validatedDeliveryVehicle : null,
      restaurantId,
      destinationLocation: validatedTypeOfOrder === "Delivery" ? validatedDestination : null,
      restaurantLocation,
      distanceKm,
      orderCode,
      userVerificationCode,
      transaction: {
        totalPrice,
        status: "Pending",
      },
    });
    // --- Validate user info for Chapa ---
    const user = await User.findById(userId);
    if (!user.firstName || !user.lastName || !user.email) {
      return res.status(400).json({
        error: { message: 'User first name, last name, and email are required for payment processing.' },
      });
    }   
    // --- Initialize Chapa payment ---
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
    if (!orderId || !status) {
      return res.status(400).json({ error: { message: "orderId and status are required." } });
    }

    // Find & update order with schema validation
    const order = await Order.findOneAndUpdate(
      { _id: orderId },
      { $set: { orderStatus: status } },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ error: { message: "Order not found." } });
    }
    // 🔑 Handle Cooked → notify drivers
    if (order.orderStatus === "Cooked" && order.typeOfOrder === "Delivery") {
      const restaurant = await Restaurant.findById(order.restaurantId);
      if (!restaurant) {
        console.error(`Restaurant ${order.restaurantId} not found for order ${order._id}`);
      }
        const deliveryGroup = order.deliveryVehicle; // "Car", "Motor", "Bicycle"
        console.log(`Broadcasting cooked order ${order._id} to delivery group "${deliveryGroup}"`);

          notifyDeliveryGroup(deliveryGroup,{
            orderId: order._id,
            orderCode: order.orderCode,
            restaurantLocation:order.restaurantLocation,
            restaurantName: restaurant.name,
            deliveryLocation:order.destinationLocation,
            deliveryFee: parseFloat(order.deliveryFee.toString()),
            tip: parseFloat(order.tip?.toString() || "0"),
            createdAt: order.createdAt,
      })
      }
    res.status(200).json({
      status: "success",
      message: `Order status updated to ${status}.`,
      data: { order },
    });
  } catch (error) {
    console.error("Error updating order status:", error.message);
    next(error);
  }
};

export const chapaWebhook = async (req, res) => {
  try {
    const { trx_ref, ref_id, status } = req.query;
    console.log("Chapa Webhook received:", { trx_ref, ref_id, status });

    // 1. Verify with Chapa
    const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
    const verifyUrl = `https://api.chapa.co/v1/transaction/verify/${trx_ref}`;

    const verifyRes = await axios.get(verifyUrl, {
      headers: { Authorization: `Bearer ${chapaSecretKey}` },
    });

    if (verifyRes.data.status !== "success") {
      return res.status(400).json({ message: "Verification failed" });
    }
    console.log("Chapa verification successful:", verifyRes.data);

    // 2. Extract orderId
    const orderId = trx_ref.replace("order-", "");
    console.log("Extracted orderId:", orderId);

    // 3. Find order (with bypassPaidFilter)
    const order = await Order.findById(orderId, null, { bypassPaidFilter: true });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 4. Update order transaction
    order.transaction.status = status === "success" ? "Paid" : "Failed";
    order.transaction.refId = ref_id;
    await order.save();

    console.log("✅ Order updated successfully:", order._id);

    // 5. Notify restaurant manager if payment succeeded
    if (status === "success") {
      const restaurant = await Restaurant.findById(order.restaurantId);
      if (restaurant?.managerId) {
        notifyRestaurantManager(restaurant.managerId, {
          orderId: order._id,
          totalPrice: order.totalPrice,
          orderCode: order.orderCode,
          typeOfOrder: order.typeOfOrder,
          createdAt: order.createdAt,
        });
        console.log(`📢 Notified manager ${restaurant.managerId} about new paid order`);
      } else {
        console.log(`⚠️ Restaurant ${order.restaurantId} has no manager assigned`);
      }
    }

    // 6. Respond OK
    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(500).json({ message: "Server error processing webhook" });
  }
};


export const verifyOrderDelivery = async (req, res, next) => {
  try {
    // Validate input
    const { order_id, verification_code } = req.body;
    const deliveryPersonId = req.user?._id;

    if (!order_id || !verification_code) {
      return res.status(400).json({
        error: { message: 'Order ID and verification code are required.' },
      });
    }
    if (typeof order_id !== 'string' || typeof verification_code !== 'string') {
      return res.status(400).json({
        error: { message: 'Order ID and verification code must be strings.' },
      });
    }
    if (!deliveryPersonId) {
      return res.status(401).json({
        error: { message: 'Unauthorized: Delivery person ID required.' },
      });
    }

    // Find and update order atomically
    const updatedOrder = await Order.findOneAndUpdate(
      {
        order_code: order_id,
        orderStatus: 'Delivering', // Ensure correct status
        deliveryId: deliveryPersonId, // Enforce delivery person match
        user_verification_code: verification_code, // Verify code
      },
      {
        $set: {
          orderStatus: 'Completed',
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      // Determine specific error
      const order = await Order.findOne({ order_code: order_id });
      if (!order) {
        return res.status(404).json({ error: { message: 'Order not found.' } });
      }
      if (order.orderStatus !== 'Delivering') {
        return res.status(400).json({
          error: { message: 'Order must be in Delivering status to verify delivery.' },
        });
      }
      if (order.deliveryId.toString() !== deliveryPersonId.toString()) {
        return res.status(403).json({
          error: { message: 'Only the assigned delivery person can verify this order.' },
        });
      }
      if (order.user_verification_code !== verification_code) {
        return res.status(400).json({ error: { message: 'Invalid verification code.' } });
      }
      return res.status(500).json({ error: { message: 'Failed to update order.' } });
    }

    

    return res.status(200).json({
      status: 'success',
      message: 'Order delivery verified successfully.',
      data: { order: updatedOrder },
    });
  } catch (error) {
    console.error(`Error verifying order delivery for order_code ${order_id}:`, error.message);
    next(error);
  }
}
export const pickUpOrder = async (req, res, next) => {
  try {
    // Validate input
    const { orderId, pickupVerificationCode } = req.body;
    if (!orderId || !pickupVerificationCode) {
      return res.status(400).json({
        error: { message: 'Order ID and pickup verification code are required.' },
      });
    }
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        error: { message: 'Invalid order ID format.' },
      });
    }
    if (typeof pickupVerificationCode !== 'string') {
      return res.status(400).json({
        error: { message: 'Pickup verification code must be a string.' },
      });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        error: { message: 'Order not found.' },
      });
    }
    if (order.typeOfOrder !== 'Delivery') {
      return res.status(400).json({
        error: { message: 'Order is not a delivery order.' },
      });
    }
    if (order.orderStatus === 'Delivering') {
      return res.status(400).json({
        error: { message: 'Order has already been picked up.' },
      });
    }
    if (order.orderStatus !== 'Cooked') {
      return res.status(400).json({
        error: { message: 'Order must be in Cooked status to be picked up.' },
      });
    }

    // Check verification code
    if (order.deliveryVerificationCode !== pickupVerificationCode) {
      return res.status(400).json({
        error: { message: 'Invalid pickup verification code.' },
      });
    }

    // Update order
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        $set: {
          orderStatus: 'Delivering',
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        error: { message: 'Order not found during update.' },
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Order status updated to Delivering.',
    });
  } catch (err) {
    console.error('Pickup Error:', err.message);
    next(err); // Pass to error-handling middleware
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
      restaurantId: restaurantId,
    })
      .populate('userId', 'firstName phone')
      .sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No matching orders found for this restaurant',
      });
    }

    const formattedOrders = orders.map(order => {


      return {
        userName: order.userId?.firstName,
        phone: order.userId?.phone,
        items: order.orderItems.map(item => ({
          foodName: item.name,
          quantity: item.quantity,
          price: Number(item.price),
        })),
        totalFoodPrice: Number(order.foodTotal),
        orderDate: order.createdAt,
        orderType: order.typeOfOrder,
        orderStatus: order.orderStatus,
        orderId: order._id,
        orderCode: order.orderCode,
        description:order.description,
        
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
    const userId = req.user._id;

    const orders = await Order.find({ userId })
      .populate("restaurant_id", "name location") // only restaurant context  
    res.status(200).json({
      status: "success",
      results: orders.length,
      data: { orders },
    });
  } catch (error) {
    console.error("Error getting user orders:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch orders",
    });
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
      orderStatus: "Cooked",
      typeOfOrder: "Delivery",
      deliveryId: { $exists: false }, // No delivery assigned yet
    })
      .populate("restaurantId", "name")
      .sort({ createdAt: 1 }); // FIFO (oldest first)

    const formattedOrders = availableOrders.map((order) => ({
      orderId: order._id,
      orderCode: order.orderCode,
      restaurantName: order.restaurantId?.name || "",
      restaurantLocation: order.restaurantLocation || null,
      deliveryLocation: order.destinationLocation || null,
      deliveryFee: parseFloat(order.deliveryFee?.toString() || "0"),
      tip: parseFloat(order.tip?.toString() || "0"),
      grandTotal: parseFloat(order.totalPrice?.toString() || "0"),
      createdAt: order.createdAt,
    }));

    res.status(200).json({
      status: "success",
      results: formattedOrders.length,
      data: formattedOrders,
    });
  } catch (error) {
    console.error("Error fetching available cooked orders:", error.message);
    res.status(500).json({
      status: "error",
      message: "Server error retrieving available cooked orders",
    });
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
    console.log(orders);
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
      
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching delivery man orders:', error.message);
    res.status(500).json({ message: 'Server error retrieving delivery orders' });
  }
};


