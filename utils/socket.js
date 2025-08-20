import { Server } from 'socket.io';

let ioInstance = null;

export const initSocket = (server) => {
  if (ioInstance) return ioInstance;
  ioInstance = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });
  return ioInstance;
};

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => ioInstance;


