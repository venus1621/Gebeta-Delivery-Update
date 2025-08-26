import { Server } from 'socket.io';

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust based on your frontend URL
      methods: ['GET', 'POST'],
    },
  });
  return io;
};

export const setIO = (ioInstance) => {
  io = ioInstance;
};

export const getIO = () => {
  if (!io) {
    console.warn('Socket.IO not initialized');
    return null;
  }
  return io;
};