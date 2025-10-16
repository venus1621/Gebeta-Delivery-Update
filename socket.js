import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from './models/userModel.js';
import Order from './models/Order.js';

// Global Maps for Tracking
const activeDeliveryOrders = new Map(); // deliveryPersonId -> { orderId, userId }
const lastDeliveryLocations = new Map(); // deliveryPersonId -> location
const deliverySockets = new Map(); // deliveryId -> Set of socketIds
const managerSockets = new Map(); // managerId -> Set of socketIds
const adminSockets = new Map(); // adminId -> Set of socketIds

// Generate Verification Code
const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Populate Active Orders
const populateActiveOrders = async (io) => {
  try {
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

// JWT Validation Middleware
const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not defined!');
    return next(new Error('Server configuration error'));
  }

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.id).select('-password -__v');

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid or expired token'));
  }
};

// Notify Customer Helper
export const notifyCustomer = (io, customerId, message) => {
  const room = `customer:${customerId}`;
  io.to(room).emit('customerMessage', message);
  console.log(`📩 Sent message to customer ${customerId} in room ${room}`);
};

// Notify Delivery Group Helper
export const notifyDeliveryGroup = (io, deliveryMethod, message) => {
  if (!['Car', 'Motor', 'Bicycle'].includes(deliveryMethod)) {
    console.log('❌ Invalid delivery method');
    return;
  }
  io.to(deliveryMethod).emit('deliveryMessage', message);
  console.log(`📢 Sent message to ${deliveryMethod} group: ${JSON.stringify(message)}`);
};

// Notify Manager Helper
export const notifyRestaurantManager = (io, managerId, orderData) => {
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

// Initialize Socket.IO
export const initSocket = (httpServer) => {
  const CLIENT_URL = process.env.CLIENT_URL || '*';
  const io = new Server(httpServer, {
    cors: {
      origin: CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.use(authenticateSocket);

  // Populate active orders on startup
//   populateActiveOrders(io);

  io.on('connection', (socket) => {
    const { _id: userId, role, deliveryMethod } = socket.user;

    console.log(
      `🔗 User connected: ${socket.id}, Role: ${role}, UserId: ${userId}`
    );

    if (!['Customer', 'Delivery_Person', 'Manager', 'Admin'].includes(role)) {
      socket.emit('errorMessage', 'Invalid user role.');
      socket.disconnect(true);
      return;
    }

    // Admin connection
    if (role === 'Admin') {
      if (!adminSockets.has(userId.toString())) {
        adminSockets.set(userId.toString(), new Set());
      }
      adminSockets.get(userId.toString()).add(socket.id);
      console.log(`🛡️ Admin ${userId} connected on socket ${socket.id}`);
      socket.emit('message', 'Welcome Admin! You are connected.');
    }

    // Customer connection
    if (role === 'Customer') {
      const room = `customer:${userId.toString()}`;
      socket.join(room);
      console.log(`🧑 Customer ${userId} joined room ${room}`);
      socket.emit('message', 'Welcome Customer! You are connected.');
    }

    // Delivery Person connection
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

      if (!deliverySockets.has(userId.toString())) {
        deliverySockets.set(userId.toString(), new Set());
      }
      deliverySockets.get(userId.toString()).add(socket.id);

      console.log(`🚚 Delivery person ${userId} joined ${deliveryMethod} group`);
      socket.emit(
        'message',
        `Welcome Delivery_Person! You are in the ${deliveryMethod} group.`
      );

      const userIdStr = userId.toString();
      if (activeDeliveryOrders.has(userIdStr)) {
        socket.activeOrder = activeDeliveryOrders.get(userIdStr);
        console.log(`🔄 Restored active order ${socket.activeOrder.orderId} for reconnecting delivery person ${userId}`);
        socket.emit('requestLocationUpdate', { reason: 'activeOrderRestored' });
        console.log(`📡 Requested location update from ${userId} for active order`);
      } else {
        console.log(`ℹ️ No active order found for delivery person ${userId} on connect`);
      }

      socket.on('locationUpdate', async ({ location }) => {
        if (!location || !location.latitude || !location.longitude) {
          console.warn('❌ Invalid location received from', socket.user._id);
          return;
        }

        try {
          const deliveryPersonId = socket.user._id.toString();
          lastDeliveryLocations.set(deliveryPersonId, location);

          if (!socket.activeOrder && activeDeliveryOrders.has(deliveryPersonId)) {
            socket.activeOrder = activeDeliveryOrders.get(deliveryPersonId);
            console.log(`🔄 Synced activeOrder from global for ${deliveryPersonId}`);
          }

          adminSockets.forEach((socketsSet) => {
            socketsSet.forEach((sid) => {
              io.to(sid).emit('deliveryLocationUpdate', { 
                userId: deliveryPersonId,
                location,
                deliveryPersonId
              });
            });
          });

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

          const existingOrder = await Order.findOne({
            deliveryId: deliveryPersonId,
            orderStatus: { $nin: ['Completed', 'Cancelled'] },
          }).session(session);

          if (existingOrder) {
            throw new Error(
              'You already have an active order. Complete or cancel it before accepting a new one.'
            );
          }

          const order = await Order.findById(orderId)
            .populate('userId', '_id')
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

          const pickUpcode = generateVerificationCode();
          order.deliveryVerificationCode = pickUpcode;
          order.deliveryId = deliveryPersonId;
          await order.save({ session });

          await session.commitTransaction();

          const activeOrderData = {
            orderId,
            userId: order.userId._id.toString()
          };
          activeDeliveryOrders.set(deliveryPersonId.toString(), activeOrderData);
          socket.activeOrder = activeOrderData;

          socket.emit('requestLocationUpdate', { reason: 'orderAccepted' });

          notifyCustomer(io, order.userId._id.toString(), {
            type: 'orderAccepted',
            orderId,
            deliveryPersonId,
            message: `Your order ${order.orderCode} has been accepted by a delivery person!`
          });

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
          
          const deliveryPersonIdStr = socket.user._id.toString();
          activeDeliveryOrders.delete(deliveryPersonIdStr);
          lastDeliveryLocations.delete(deliveryPersonIdStr);
          delete socket.activeOrder;
          
          notifyCustomer(io, order.userId._id.toString(), { 
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

    // Manager connection
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

      if (role === 'Delivery_Person') {
        if (socket.activeOrder) {
          console.log(`⚠️ Clearing activeOrder for disconnected delivery person ${userId}`);
          activeDeliveryOrders.delete(userId.toString());
          lastDeliveryLocations.delete(userId.toString());
          delete socket.activeOrder;
        }

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

  return io;
};