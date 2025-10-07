import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import User from './models/userModel.js';
import Order from './models/Order.js';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_URL = process.env.CLIENT_URL || '*';
const PORT = process.env.PORT || 3000;

if (!DB) {
  console.error('DATABASE environment variable is not defined!');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('JWT_SECRET environment variable is not defined!');
  process.exit(1);
}

mongoose
  .connect(DB)
  .then(async () => {
    console.log('✅ DB connection successful!');
    
    // Populate activeDeliveryOrders from DB on startup
    await populateActiveOrders();
  })
  .catch((err) => {
    console.error('DB connection error:', err.message);
    process.exit(1);
  });

// ================= Function to Fetch and Populate Active Orders =================
const populateActiveOrders = async () => {
  try {
    // Fetch all orders in 'Delivering' status
    const activeOrders = await Order.find({
      orderStatus: 'Delivering',
      deliveryId: { $exists: true, $ne: null }
    }).populate('userId', '_id').select('_id deliveryId userId orderStatus');

    activeOrders.forEach((order) => {
      if (order.deliveryId && order.userId) {
        const deliveryPersonIdStr = order.deliveryId.toString();
        activeDeliveryOrders.set(deliveryPersonIdStr, {
          orderId: order._id.toString(),
          userId: order.userId._id.toString()
        });
        console.log(`💾 Loaded active order ${order._id} for delivery person ${deliveryPersonIdStr}`);
      }
    });

    console.log(`✅ Loaded ${activeOrders.length} active delivering orders into memory`);

    // Request location updates from connected delivery persons for active orders
    for (const deliveryPersonIdStr of activeDeliveryOrders.keys()) {
      const sockets = deliverySockets.get(deliveryPersonIdStr);
      if (sockets && sockets.size > 0) {
        sockets.forEach((sid) => {
          io.to(sid).emit('requestLocationUpdate', { reason: 'serverRestartActiveOrder' });
        });
        console.log(`📡 Requested location update from connected delivery person ${deliveryPersonIdStr} for active order`);
      }
    }
  } catch (err) {
    console.error('❌ Error populating active orders:', err);
  }
};

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// ================= Global Active Orders Tracking =================
// deliveryPersonId (string) -> { orderId: string, userId: string (customer _id) }
const activeDeliveryOrders = new Map();

// ================= Global Last Locations Tracking =================
// deliveryPersonId (string) -> location object
const lastDeliveryLocations = new Map();

// ================= Track Delivery Person Connections =================
// deliveryId -> Set of socketIds
const deliverySockets = new Map();

// ================= JWT Validation Middleware =================
const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.id).select('-password -__v');

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    socket.user = user; // attach user object without sensitive fields
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid or expired token'));
  }
};

io.use(authenticateSocket);

// ================= Track Manager Connections =================
// managerId -> Set of socketIds
const managerSockets = new Map();

// ================= Track Admin Connections =================
// adminId -> Set of socketIds
const adminSockets = new Map();

// ================= Handle Connections by Role =================
io.on('connection', (socket) => {
  const { _id: userId, role, deliveryMethod } = socket.user;

  console.log(
    `🔗 User connected: ${socket.id}, Role: ${role}, UserId: ${userId}`
  );

  // Validate role
  if (!['Customer', 'Delivery_Person', 'Manager','Admin'].includes(role)) {
    socket.emit('errorMessage', 'Invalid user role.');
    socket.disconnect(true);
    return;
  }

  // ---------------- Admin connection ----------------
  if (role === 'Admin') {
    if (!adminSockets.has(userId.toString())) {
      adminSockets.set(userId.toString(), new Set());
    }
    adminSockets.get(userId.toString()).add(socket.id);
    console.log(`🛡️ Admin ${userId} connected on socket ${socket.id}`);
    socket.emit('message', 'Welcome Admin! You are connected.');
  }

  // Role-specific logic
  if (role === 'Customer') {
    const room = `customer:${userId.toString()}`;
    socket.join(room);
    console.log(`🧑 Customer ${userId} joined room ${room}`);
    socket.emit('message', 'Welcome Customer! You are connected.');
  }

  if (role === 'Delivery_Person') {
    if (!['Car', 'Motor', 'Bicycle'].includes(deliveryMethod)) {
      socket.emit(
        'errorMessage',
        'Invalid delivery method. Allowed: Car, Motor, Bicycle'
      );
      socket.disconnect(true);
      return;
    }
    socket.join(deliveryMethod);

    // Track delivery sockets
    if (!deliverySockets.has(userId.toString())) {
      deliverySockets.set(userId.toString(), new Set());
    }
    deliverySockets.get(userId.toString()).add(socket.id);

    console.log(`🚚 Delivery person ${userId} joined ${deliveryMethod} group`);
    socket.emit(
      'message',
      `Welcome Delivery_Person! You are in the ${deliveryMethod} group.`
    );

    // Restore active order on connect/reconnect
    const userIdStr = userId.toString();
    if (activeDeliveryOrders.has(userIdStr)) {
      socket.activeOrder = activeDeliveryOrders.get(userIdStr);
      console.log(`🔄 Restored active order ${socket.activeOrder.orderId} for reconnecting delivery person ${userId}`);
      // Request initial location update for the customer
      socket.emit('requestLocationUpdate', { reason: 'activeOrderRestored' });
      console.log(`📡 Requested location update from ${userId} for active order`);
    } else {
      console.log(`ℹ️ No active order found for delivery person ${userId} on connect`);
    }

    // 📍 Handle location updates from delivery person and forward to admins/customers
    socket.on('locationUpdate', async ({ location }) => {
      if (!location || !location.latitude || !location.longitude) {
        console.warn('❌ Invalid location received from', socket.user._id);
        return;
      }

      try {
        const deliveryPersonId = socket.user._id.toString();

        // Store last location
        lastDeliveryLocations.set(deliveryPersonId, location);

        // Fallback to global if socket prop is missing (e.g., reconnect)
        if (!socket.activeOrder && activeDeliveryOrders.has(deliveryPersonId)) {
          socket.activeOrder = activeDeliveryOrders.get(deliveryPersonId);
          console.log(`🔄 Synced activeOrder from global for ${deliveryPersonId}`);
        }

        // Forward location to all connected admin sockets
        adminSockets.forEach((socketsSet) => {
          socketsSet.forEach((sid) => {
            io.to(sid).emit('deliveryLocationUpdate', { 
              userId: deliveryPersonId,
              location,
              deliveryPersonId
            });
          });
        });

        // Forward to the customer if active order exists
        if (socket.activeOrder?.userId) {
          const customerRoom = `customer:${socket.activeOrder.userId}`;
          io.to(customerRoom).emit('deliveryLocationUpdate', {
            deliveryPersonId,
            location,
            orderId: socket.activeOrder.orderId,
          });
          console.log(`📍 Location update sent to customer ${socket.activeOrder.userId} for order ${socket.activeOrder.orderId}`);
        } else {
          console.debug(`ℹ️ No active order for ${deliveryPersonId} – skipping customer notify`);
        }

        console.log(`📍 Location update emitted successfully for delivery person ${deliveryPersonId}`);
      } catch (err) {
        console.error('❌ Error handling location update:', err);
      }
    });

    socket.on('acceptOrder', async ({ orderId }, callback) => {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const deliveryPersonId = socket.user._id;

        if (!orderId) {
          throw new Error('Order ID is required.');
        }

        // Check if delivery person already has an active order
        const existingOrder = await Order.findOne({
          deliveryId: deliveryPersonId,
          orderStatus: { $nin: ['Completed', 'Cancelled'] },
        }).session(session);

        if (existingOrder) {
          throw new Error(
            'You already have an active order. Complete or cancel it before accepting a new one.'
          );
        }

        // Fetch order with userId populated and check deliveryVehicle
        const order = await Order.findById(orderId)
          .populate('userId', '_id')  // Populate userId field to get order.userId._id
          .session(session);
        if (!order) {
          throw new Error('Order is not available for acceptance.');
        }

        const orderVehicle = order.deliveryVehicle;
        if (socket.user.deliveryMethod !== orderVehicle) {
          throw new Error(
            'You are not eligible to accept the order'
          );
        }

        // Generate verification code and update order
        const pickUpcode = generateVerificationCode();
        order.deliveryVerificationCode = pickUpcode;
        order.deliveryId = deliveryPersonId;
        await order.save({ session });

        await session.commitTransaction();

        // Persist globally and sync to socket
        const activeOrderData = {
          orderId,
          userId: order.userId._id.toString()  // Use populated _id as string for room key
        };
        activeDeliveryOrders.set(deliveryPersonId.toString(), activeOrderData);
        socket.activeOrder = activeOrderData;

        // Request location update after acceptance
        socket.emit('requestLocationUpdate', { reason: 'orderAccepted' });

        // Notify customer of acceptance
        notifyCustomer(order.userId._id.toString(), {
          type: 'orderAccepted',
          orderId,
          deliveryPersonId,
          message: `Your order ${order.orderCode} has been accepted by a delivery person!`
        });

        // Success response back to this delivery person
        callback({
          status: 'success',
          message: `Order ${order.orderCode} accepted.`,
          data: {
            restaurantLocation: order.restaurantLocation,
            deliverLocation: order.destinationLocation,
            deliveryFee: parseFloat(order.deliveryFee?.toString() || "0"),
            tip: parseFloat(order.tip?.toString() || "0"),
            distanceKm: order.distanceKm,
            description: order.description,
            status: order.orderStatus,
            orderCode: order.orderCode,
            pickUpVerification: order.deliveryVerificationCode,
          },
        });  

      } catch (error) {
        await session.abortTransaction();
        console.error('Error accepting order:', error);
        let message = error.message || 'An error occurred while accepting the order.';
        if (error.name === 'CastError') message = 'Invalid order ID.';
        callback({
          status: 'error',
          message,
          ...(error.activeOrder && { activeOrder: error.activeOrder }),
        });
      } finally {
        session.endSession();
      }
    });

    // Updated completeOrder handler
    socket.on('completeOrder', async ({ orderId }, callback) => {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const order = await Order.findById(orderId).populate('userId', '_id').session(session);
        if (!order || order.deliveryId.toString() !== socket.user._id.toString()) {
          throw new Error('Cannot complete this order.');
        }
        order.orderStatus = 'Completed';
        await order.save({ session });
        await session.commitTransaction();
        
        // Clear globally and locally
        const deliveryPersonIdStr = socket.user._id.toString();
        activeDeliveryOrders.delete(deliveryPersonIdStr);
        lastDeliveryLocations.delete(deliveryPersonIdStr);  // Clear last location
        delete socket.activeOrder;
        
        // Notify customer and admins
        notifyCustomer(order.userId._id.toString(), { 
          type: 'orderCompleted', 
          orderId,
          message: `Your order ${order.orderCode} has been completed!`
        });
        adminSockets.forEach((socketsSet) => {
          socketsSet.forEach((sid) => {
            io.to(sid).emit('orderCompleted', { 
              orderId, 
              deliveryPersonId: socket.user._id 
            });
          });
        });
        
        callback({ status: 'success', message: 'Order completed.' });
      } catch (error) {
        await session.abortTransaction();
        callback({ status: 'error', message: error.message });
      } finally {
        session.endSession();
      }
    });
  }

  if (role === 'Manager') {
    if (!managerSockets.has(userId.toString())) {
      managerSockets.set(userId.toString(), new Set());
    }
    managerSockets.get(userId.toString()).add(socket.id);
    console.log(`🏢 Manager ${userId} mapped to socket ${socket.id}`);
    socket.emit('message', 'Welcome Manager! You are connected.');
  }

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);

    // Clear activeOrder and track on disconnect for delivery persons
    if (role === 'Delivery_Person') {
      if (socket.activeOrder) {
        console.log(`⚠️ Clearing activeOrder for disconnected delivery person ${userId}`);
        activeDeliveryOrders.delete(userId.toString());  // Clear global
        lastDeliveryLocations.delete(userId.toString());  // Clear last location
        delete socket.activeOrder;
      }

      // Remove from deliverySockets
      if (deliverySockets.has(userId.toString())) {
        deliverySockets.get(userId.toString()).delete(socket.id);
        if (deliverySockets.get(userId.toString()).size === 0) {
          deliverySockets.delete(userId.toString());
        }
      }
    }

    if (role === 'Manager' && managerSockets.has(userId.toString())) {
      managerSockets.get(userId.toString()).delete(socket.id);
      if (managerSockets.get(userId.toString()).size === 0) {
        managerSockets.delete(userId.toString());
      }
    }

    if (role === 'Admin' && adminSockets.has(userId.toString())) {
      adminSockets.get(userId.toString()).delete(socket.id);
      if (adminSockets.get(userId.toString()).size === 0) {
        adminSockets.delete(userId.toString());
      }
    }
  });
});

// ================= Helper: Notify Manager =================
export const notifyRestaurantManager = (managerId, orderData) => {
  const sockets = managerSockets.get(managerId.toString());
  if (sockets && sockets.size > 0) {
    sockets.forEach((sid) => {
      io.to(sid).emit('newOrder', orderData);
    });
    console.log(`✅ Notified manager ${managerId} on ${sockets.size} device(s)`);
  } else {
    console.log(`⚠️ Manager ${managerId} is not connected`);
  }
};

// ================= Helper: Send to Delivery Group =================
export const notifyDeliveryGroup = (deliveryMethod, message) => {
  if (!['Car', 'Motor', 'Bicycle'].includes(deliveryMethod)) {
    console.log('❌ Invalid delivery method');
    return;
  }
  io.to(deliveryMethod).emit('deliveryMessage', message);
  console.log(`📢 Sent message to ${deliveryMethod} group: ${JSON.stringify(message)}`);
};

// ================= Helper: Notify Customer =================
export const notifyCustomer = (customerId, message) => {
  const room = `customer:${customerId}`;
  io.to(room).emit('customerMessage', message);
  console.log(`📩 Sent message to customer ${customerId} in room ${room}`);
};

// ================= Start Server =================
httpServer.listen(PORT, () => {
  console.log(`🚀 App running on port ${PORT}...`);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  io.close(() => {
    httpServer.close(() => {
      process.exit(1);
    });
  });
});