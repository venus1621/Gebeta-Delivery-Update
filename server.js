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
  .then(() => console.log('✅ DB connection successful!'))
  .catch((err) => {
    console.error('DB connection error:', err.message);
    process.exit(1);
  });

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// NEW: Attach io to app for access in REST controllers
app.set('io', io);

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

// ================= Track Delivery Person Connections =================
// NEW: deliveryId -> Set of socketIds (for notifying specific delivery persons)
const deliverySockets = new Map();

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
    // NEW: Track delivery sockets
    if (!deliverySockets.has(userId.toString())) {
      deliverySockets.set(userId.toString(), new Set());
    }
    deliverySockets.get(userId.toString()).add(socket.id);
    console.log(`🚚 Delivery person ${userId} mapped to socket ${socket.id}`);
    console.log(`🚚 Delivery person ${userId} joined ${deliveryMethod} group`);
    socket.emit(
      'message',
      `Welcome Delivery_Person! You are in the ${deliveryMethod} group.`
    );

    // 📍 Handle location updates from delivery person and forward to admins
    socket.on('locationUpdate', async ({ userId: receivedUserId, location }) => {
      if (!location || !location.latitude || !location.longitude) {
        console.warn('❌ Invalid location received from', receivedUserId);
        return;
      }

      try {
        // Forward location to all connected admin sockets
        adminSockets.forEach((socketsSet) => {
          socketsSet.forEach((sid) => {
            io.to(sid).emit('deliveryLocationUpdate', { 
              userId: receivedUserId, 
              location,
              deliveryPersonId: socket.user._id // Include the delivery person ID for reference
            });
          });
        });
        console.log("active orders..............................")
        console.log(socket.activeOrder);
         // UPDATED: Forward to the customer using notifyCustomer helper
    if (socket.activeOrder?.customerId) {
      notifyCustomer(socket.activeOrder.customerId, {
        event: 'deliveryLocationUpdate',
        data: {
          deliveryPersonId: socket.user._id,
          location,
          orderId: socket.activeOrder.orderId,
        }
      });
      console.log(`📍 Location update sent to customer ${socket.activeOrder.customerId} via notifyCustomer`);
    }
        console.log(`📍 Location update emitted successfully for user ${receivedUserId}:`, location);
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

    // Fetch order to check deliveryVehicle
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error('Order is not available for acceptance.');
    }

    const orderVehicle = order.deliveryVehicle;
    if (socket.user.deliveryMethod !== orderVehicle) {
      throw new Error('You are not eligible to accept the order');
    }

    // Generate verification code and update order
    const pickUpcode = generateVerificationCode();
    order.deliveryVerificationCode = pickUpcode;
    order.deliveryId = deliveryPersonId;
    order.orderStatus = 'Accepted'; // Update status to Accepted
    await order.save({ session });

    await session.commitTransaction();

    // Set the active order on the socket (with validation for userId)
    if (!order.userId) {
      throw new Error('Order is missing userId (customer reference).');
    }
    socket.activeOrder = {
      customerId: order.userId,
      deliveryPersonId: order.deliveryId,
      orderId: order._id,
    };

    // Success response back to this delivery person
    callback({
      status: 'success',
      message: `Order ${order.order_id} accepted.`,
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
    });
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

    // NEW: Handle Delivery_Person disconnect
    if (role === 'Delivery_Person' && deliverySockets.has(userId.toString())) {
      deliverySockets.get(userId.toString()).delete(socket.id);
      if (deliverySockets.get(userId.toString()).size === 0) {
        deliverySockets.delete(userId.toString());
      }
      // Clear activeOrder on disconnect to prevent stale data
      if (socket.activeOrder) {
        console.log(`⚠️ Clearing active order ${socket.activeOrder.orderId} due to disconnect for ${userId}`);
        socket.activeOrder = null;
        // Optionally: Reassign or cancel the order in DB here if needed
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
  const room = `customer:${customerId.toString()}`;
  io.to(room).emit('customerMessage', message);
  console.log(`📩 Sent message to customer ${customerId} in room ${room}`);
};

// ================= Helper: Notify Delivery Person =================
export const notifyDeliveryPerson = (deliveryPersonId, message) => {
  const sockets = deliverySockets.get(deliveryPersonId.toString());
  if (sockets && sockets.size > 0) {
    sockets.forEach((sid) => {
      io.to(sid).emit('deliveryMessage', message);
    });
    console.log(`✅ Notified delivery person ${deliveryPersonId} on ${sockets.size} device(s)`);
  } else {
    console.log(`⚠️ Delivery person ${deliveryPersonId} is not connected`);
  }
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