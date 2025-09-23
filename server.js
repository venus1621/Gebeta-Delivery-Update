import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE;

if (!DB) {
  console.error('DATABASE environment variable is not defined!');
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

// Delivery Namespace
export const deliveryNamespace = io.of('/delivery');
deliveryNamespace.on('connection', (socket) => {
  console.log('A delivery guy connected:', socket.id);

  socket.on('joinVehicleRoom', (vehicleType) => {
    if (['Car', 'Motor', 'Bicycle'].includes(vehicleType)) {
      socket.join(vehicleType);
      console.log(`Socket ${socket.id} joined room: ${vehicleType}`);
      socket.emit('message', `Welcome! You are in the ${vehicleType} room.`);
    } else {
      socket.emit('error', 'Invalid vehicle type. Allowed types: Car, Motor, Bicycle');
    }
  });

  socket.on('sendToVehicleRoom', ({ vehicleType, message }) => {
    if (['Car', 'Motor', 'Bicycle'].includes(vehicleType)) {
      deliveryNamespace.to(vehicleType).emit('message', message);
      console.log(`Message sent to ${vehicleType} room: ${message}`);
    } else {
      socket.emit('error', 'Invalid vehicle type. Allowed types: Car, Motor, Bicycle');
    }
  });

  socket.on('disconnect', () => {
    console.log('A delivery guy disconnected:', socket.id);
  });
});

// Restaurant Namespace
export const restaurantNamespace = io.of('/restaurant');
restaurantNamespace.on('connection', (socket) => {
  console.log('A restaurant client connected:', socket.id);

  socket.on('joinRestaurantRoom', (restaurantId) => {
    if (restaurantId) {
      socket.join(restaurantId);
      console.log(`Socket ${socket.id} joined restaurant room: ${restaurantId}`);
      socket.emit('message', `Welcome! You are in the restaurant room: ${restaurantId}`);
    } else {
      socket.emit('error', 'Invalid restaurant ID');
    }
  });

  socket.on('sendToRestaurantRoom', ({ restaurantId, message }) => {
    if (restaurantId) {
      restaurantNamespace.to(restaurantId).emit('message', message);
      console.log(`Message sent to restaurant ${restaurantId} room: ${message}`);
    } else {
      socket.emit('error', 'Invalid restaurant ID');
    }
  });

  socket.on('disconnect', () => {
    console.log('A restaurant client disconnected:', socket.id);
  });
});

httpServer.listen(port, () => {
  console.log(`🚀 App running on port ${port}...`);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  httpServer.close(() => {
    process.exit(1);
  });
});