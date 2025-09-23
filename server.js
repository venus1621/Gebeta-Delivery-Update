import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import User from './models/userModel.js';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE;
const JWT_SECRET = process.env.JWT_SECRET;

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

const port = process.env.PORT || 3000;
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// ================= JWT Validation Middleware =================
const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    socket.user = user; // attach full user object from DB
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid or expired token'));
  }
};

io.use(authenticateSocket);

// ================= Track Manager Connections =================
// managerId -> Set of socketIds
const managerSockets = new Map();

// ================= Handle Connections by Role =================
io.on('connection', (socket) => {
  const { _id: userId, role, deliveryMethod } = socket.user;

  console.log(
    `🔗 User connected: ${socket.id}, Role: ${role}, UserId: ${userId}`
  );

  // If Delivery_Person -> join deliveryMethod room
  if (role === 'Delivery_Person') {
    if (!['Car', 'Motor', 'Bicycle'].includes(deliveryMethod)) {
      socket.emit(
        'errorMessage',
        'Invalid delivery method. Allowed: Car, Motor, Bicycle'
      );
      return;
    }
    socket.join(deliveryMethod);
    console.log(`🚚 Delivery person ${userId} joined ${deliveryMethod} group`);
    socket.emit(
      'message',
      `Welcome Delivery_Person! You are in the ${deliveryMethod} group.`
    );
  }

  // If Manager -> map socket to managerId
  if (role === 'Manager') {
    if (!managerSockets.has(userId.toString())) {
      managerSockets.set(userId.toString(), new Set());
    }
    managerSockets.get(userId.toString()).add(socket.id);
    console.log(`🏢 Manager ${userId} mapped to socket ${socket.id}`);
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
  console.log(`📢 Sent message to ${deliveryMethod} group: ${message}`);
};

// ================= Helper: Notify Customer =================
export const notifyCustomer = (customerId, message) => {
  io.to(`customer:${customerId}`).emit('customerMessage', message);
  console.log(`📩 Sent message to customer ${customerId}`);
};

// ================= Start Server =================
httpServer.listen(port, () => {
  console.log(`🚀 App running on port ${port}...`);
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
