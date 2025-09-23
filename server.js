import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';

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
const io = new Server(httpServer);

// JWT Validation Middleware
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach decoded token data to socket
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
};

// Delivery Namespace
export const deliveryNamespace = io.of('/delivery');
deliveryNamespace.use(authenticateSocket); // Apply JWT middleware
deliveryNamespace.on('connection', (socket) => {
  console.log(`A delivery guy connected: ${socket.id}, User: ${socket.user.id}`);

  socket.on('joinVehicleRoom', (vehicleType) => {
    if (!['Car', 'Motor', 'Bicycle'].includes(vehicleType)) {
      socket.emit('error', 'Invalid vehicle type. Allowed types: Car, Motor, Bicycle');
      return;
    }
    try {
      socket.join(vehicleType);
      console.log(`Socket ${socket.id} joined room: ${vehicleType}`);
      socket.emit('message', `Welcome! You are in the ${vehicleType} room.`);
    } catch (err) {
      socket.emit('error', 'Failed to join room');
    }
  });

  socket.on('sendToVehicleRoom', ({ vehicleType, message }) => {
    if (!['Car', 'Motor', 'Bicycle'].includes(vehicleType)) {
      socket.emit('error', 'Invalid vehicle type. Allowed types: Car, Motor, Bicycle');
      return;
    }
    try {
      deliveryNamespace.to(vehicleType).emit('message', message);
      console.log(`Message sent to ${vehicleType} room: ${message}`);
    } catch (err) {
      socket.emit('error', 'Failed to send message');
    }
  });

  socket.on('disconnect', () => {
    console.log(`A delivery guy disconnected: ${socket.id}`);
  });
});

// Restaurant Namespace
export const restaurantNamespace = io.of('/restaurant');
restaurantNamespace.use(authenticateSocket); // Apply JWT middleware
restaurantNamespace.on('connection', (socket) => {
  console.log(`A restaurant client connected: ${socket.id}, User: ${socket.user.id}`);

  socket.on('joinRestaurantRoom', (restaurantId) => {
    if (!restaurantId || typeof restaurantId !== 'string') {
      socket.emit('error', 'Invalid restaurant ID');
      return;
    }
    try {
      socket.join(restaurantId);
      console.log(`Socket ${socket.id} joined restaurant room: ${restaurantId}`);
      socket.emit('message', `Welcome! You are in the restaurant room: ${restaurantId}`);
    } catch (err) {
      socket.emit('error', 'Failed to join room');
    }
  });

  socket.on('sendToRestaurantRoom', ({ restaurantId, message }) => {
    if (!restaurantId || typeof restaurantId !== 'string') {
      socket.emit('error', 'Invalid restaurant ID');
      return;
    }
    try {
      restaurantNamespace.to(restaurantId).emit('message', message);
      console.log(`Message sent to restaurant ${restaurantId} room: ${message}`);
    } catch (err) {
      socket.emit('error', 'Failed to send message');
    }
  });

  socket.on('disconnect', () => {
    console.log(`A restaurant client disconnected: ${socket.id}`);
  });
});

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