import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import { initSocket, setIO, getIO } from './utils/socket.js';
import Order from './models/Order.js'; // Import the Order model
import { generateVerificationCode } from './controllers/orderController.js'; // Import the verification code generator

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
    const count = await Order.countDocuments({
      orderStatus: 'Cooked',
      typeOfOrder: 'Delivery',
      deliveryId: { $exists: false },
    });
    io.to('deliveries').emit('available-orders-count', { count });
    console.log(`📢 Broadcasted available orders count: ${count}`);
  } catch (error) {
    console.error('Error broadcasting available orders count:', error);
  }
};

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  socket.on('joinRole', (role) => {
    if (role === 'Delivery_Person') {
      socket.join('deliveries');
      // Send current count when joining
      broadcastAvailableOrdersCount();
    }
    if (role === 'Admin' || role === 'Manager') socket.join('admin');
    if (role === 'Customer') socket.join(`user_${socket.userId}`); // Assuming userId is sent with role
    if (role === 'Restaurant') socket.join(`restaurant_${socket.restaurantId}`); // Assuming restaurantId is sent
  });

  // Join delivery method-specific room
  socket.on('joinDeliveryMethod', (payload) => {
    const method = payload?.method;
    if (['Car', 'Motor', 'Bicycle'].includes(method)) {
      socket.join(`deliveries:${method}`);
      console.log(`Client ${socket.id} joined deliveries:${method} room`);
    }
  });

  // Handle order acceptance via Socket.IO
  socket.on('acceptOrder', async (data, callback) => {
    try {
      const { orderId, deliveryPersonId } = data;

      // Validate input
      if (!orderId || !deliveryPersonId) {
        return callback({
          status: 'error',
          message: 'Order ID and delivery person ID are required.',
        });
      }

      // Find and update the order atomically
      const order = await Order.findOneAndUpdate(
        {
          _id: orderId,
          orderStatus: 'Cooked',
          typeOfOrder: 'Delivery',
          deliveryId: { $exists: false },
        },
        {
          orderStatus:'Delivering',
          deliveryId: deliveryPersonId,
          deliveryVerificationCode: generateVerificationCode(),
        },
        { new: true }
      )
        .populate('userId', 'firstName lastName phone')
        .populate('restaurant_id', 'name location')
        .populate('orderItems.foodId', 'foodName price');

      if (!order) {
        return callback({
          status: 'error',
          message: 'Order is not available for acceptance.',
        });
      }

      // Format order data for broadcasting
      const formattedOrder = {
        orderId: order._id,
        order_id: order.order_id,
        restaurantLocation: {
          lat: order.restaurant_id?.location?.coordinates?.[1] || 0,
          lng: order.restaurant_id?.location?.coordinates?.[0] || 0,
        },
        restaurantName: order.restaurant_id?.name,
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
        deliveryPersonId,
        deliveryVerificationCode: order.deliveryVerificationCode,
      };

      // Emit events to relevant rooms
      io.to('deliveries').emit('order:accepted', formattedOrder);
      io.to(`restaurant_${order.restaurant_id._id}`).emit('order:accepted', formattedOrder);
      io.to(`user_${order.userId._id}`).emit('order:accepted', {
        orderId: order._id,
        order_id: order.order_id,
        message: `Your order ${order.order_id} has been accepted by a delivery person.`,
      });

      // Broadcast updated available orders count
      await broadcastAvailableOrdersCount();

      console.log(`✅ Order ${order.order_id} accepted by delivery person ${deliveryPersonId}`);

      // Send response to the client
      callback({
        status: 'success',
        message: `Order ${order.order_id} accepted.`,
        data: {
          orderCode: order.order_id,
          pickUpVerification: order.deliveryVerificationCode,
        },
      });
    } catch (error) {
      console.error('Error accepting order via Socket.IO:', error.message);
      callback({
        status: 'error',
        message: 'Failed to accept order.',
        error: error.message,
      });
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
