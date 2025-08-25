import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config/env';

/**
 * Establishes a Socket.IO connection, joins delivery rooms, and subscribes to events.
 */
export function useDeliverySocket({ vehicleMethod, onCooked, onAvailableCount, onDisconnected } = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    const STATIC_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OTFhNWZjNTZlYWE3ODgxMDJmOGM5MyIsImlhdCI6MTc1NjEwNjIzMywiZXhwIjoxNzYzODgyMjMzfQ.YW0ukdUv5DJIs4MT9YMk-8IQPUXUlP_OHa4xutrrjy8";
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      auth: {
        token: STATIC_TOKEN,
      },
      extraHeaders: {
        Authorization: `Bearer ${STATIC_TOKEN}`,
      },
    });
    socketRef.current = socket;

    const handleConnect = () => {
      console.log('🔌 Connected to delivery socket');
      socket.emit('joinRole', 'Delivery_Person');
      if (vehicleMethod) {
        socket.emit('joinDeliveryMethod', { method: vehicleMethod });
      }
      // Request current count when connecting
      socket.emit('get-available-orders-count');
    };

    const handleCooked = (payload) => {
      console.log('🍕 New cooked order received:', payload);
      if (typeof onCooked === 'function') onCooked(payload);
    };

    const handleAvailableCount = (data) => {
      console.log('📊 Available orders count:', data.count);
      if (typeof onAvailableCount === 'function') onAvailableCount(data.count);
    };

    const handleDisconnect = () => {
      console.log('🔌 Disconnected from delivery socket');
      if (typeof onDisconnected === 'function') onDisconnected();
    };

    socket.on('connect', handleConnect);
    socket.on('order:cooked', handleCooked);
    socket.on('available-orders-count', handleAvailableCount);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('order:cooked', handleCooked);
      socket.off('available-orders-count', handleAvailableCount);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [vehicleMethod, onCooked, onAvailableCount, onDisconnected]);

  return socketRef;
}


