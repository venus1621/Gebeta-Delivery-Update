import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import { initSocket } from './socket.js';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });


const DB = process.env.DATABASE;
const PORT = process.env.PORT || 3000;

if (!DB) {
  console.error('DATABASE environment variable is not defined!');
  process.exit(1);
}

mongoose
  .connect(DB)
  .then(() => {
    console.log('✅ DB connection successful!');
  })
  .catch((err) => {
    console.error('DB connection error:', err.message);
    process.exit(1);
  });

const httpServer = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(httpServer);

// Start Server
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