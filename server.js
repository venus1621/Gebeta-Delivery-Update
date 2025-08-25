import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import { initSocket, setIO } from './utils/socket.js';

process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE;

mongoose.connect(DB).then(() => console.log('✅ DB connection successful!'));

const port = process.env.PORT || 3000;
const server = http.createServer(app);
const io = initSocket(server);
setIO(io);

// Function to broadcast available orders count to delivery apps
const broadcastAvailableOrdersCount = async () => {
  try {
    const Order = mongoose.model('Order');
    const count = await Order.countDocuments({ 
      orderStatus: 'Cooked', 
      typeOfOrder: 'Delivery',
      deliveryId: { $exists: false }
    });
    
    io.to('deliveries').emit('available-orders-count', { count });
  } catch (error) {
    console.error('Error broadcasting available orders count:', error);
  }
};

io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  socket.on('joinRole', (role) => {
    if (role === 'Delivery_Person') {
      socket.join('deliveries');
      // Send current count when joining
      broadcastAvailableOrdersCount();
    }
    if (role === 'Admin' || role === 'Manager') socket.join('admin');
  });

  // Optional: delivery clients can also join a method-specific room
  // expected payload: { method: 'Car' | 'Motor' | 'Bicycle' }
  socket.on('joinDeliveryMethod', (payload) => {
    const method = payload?.method;
    if (method === 'Car' || method === 'Motor' || method === 'Bicycle') {
      socket.join(`deliveries:${method}`);
    }
  });

  // Request current available orders count
  socket.on('get-available-orders-count', () => {
    broadcastAvailableOrdersCount();
  });

  socket.on('message', (data) => {
    console.log('📩 Received message:', data);
    io.emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`🚀 App running on port ${port}...`);
});

process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
