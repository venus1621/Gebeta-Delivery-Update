import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { orderService } from '../services/orderService';

const OrderContext = createContext();

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

export const OrderProvider = ({ children }) => {
  const { token } = useAuth();
  const [availableOrders, setAvailableOrders] = useState([]);
  const [acceptedOrders, setAcceptedOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [availableOrdersCount, setAvailableOrdersCount] = useState(0);
  const socketRef = useRef(null);

  // Socket connection
  useEffect(() => {
    if (token) {
      connectSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token]);

  const connectSocket = () => {
    try {
      // Connect to the backend socket server
      socketRef.current = io('https://gebeta-delivery1.onrender.com', {
        transports: ['websocket'],
        auth: {
          token: token
        }
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Connected to socket server');
        
        // Join the deliveries room
        socketRef.current.emit('joinRole', 'Delivery_Person');
      });

      socketRef.current.on('disconnect', () => {
        console.log('❌ Disconnected from socket server');
      });

      // Listen for new cooked orders
      socketRef.current.on('order:cooked', (orderData) => {
        console.log('🍕 New cooked order received:', orderData);
        
        setAvailableOrders(prev => {
          const newOrder = {
            ...orderData,
            id: orderData.orderId,
            status: 'Cooked',
            type: 'Delivery'
          };
          
          // Check if order already exists
          const exists = prev.find(order => order.id === newOrder.id);
          if (!exists) {
            return [...prev, newOrder];
          }
          return prev;
        });
        
        // Update count
        setAvailableOrdersCount(prev => prev + 1);
        
        // Show notification
        Alert.alert(
          'New Order Available! 🍕',
          `Order ${orderData.order_id} is ready for pickup`,
          [
            { text: 'View Orders', onPress: () => {} },
            { text: 'OK', style: 'default' }
          ]
        );
      });

      // Listen for order accepted events
      socketRef.current.on('order:accepted', (orderData) => {
        console.log('✅ Order accepted event received:', orderData);
        
        // Remove from available orders
        setAvailableOrders(prev => prev.filter(order => order.id !== orderData.orderId));
        
        // Update count
        setAvailableOrdersCount(prev => Math.max(0, prev - 1));
        
        // Show notification if this wasn't accepted by us
        Alert.alert(
          'Order Accepted',
          `Order ${orderData.order_id} has been accepted by another delivery person.`,
          [{ text: 'OK', style: 'default' }]
        );
      });

      // Listen for available orders count updates
      socketRef.current.on('available-orders-count', ({ count }) => {
        console.log('📊 Available orders count updated:', count);
        setAvailableOrdersCount(count);
      });

      // Listen for order status updates
      socketRef.current.on('order:status-updated', (orderData) => {
        console.log('🔄 Order status updated:', orderData);
        
        // Update accepted orders if we have this order
        setAcceptedOrders(prev => 
          prev.map(order => 
            order.id === orderData.orderId 
              ? { ...order, status: orderData.status }
              : order
          )
        );
        
        // Update current order if it matches
        if (currentOrder && currentOrder.id === orderData.orderId) {
          setCurrentOrder(prev => ({ ...prev, status: orderData.status }));
        }
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

    } catch (error) {
      console.error('Socket connection error:', error);
    }
  };

  const acceptOrder = async (orderId) => {
    try {
      // Use socket-based order acceptance
      return new Promise((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error('Socket not connected'));
          return;
        }

        // Get user ID from token (you might need to decode the JWT token)
        const user = JSON.parse(atob(token.split('.')[1]));
        const deliveryPersonId = user._id;

        socketRef.current.emit('acceptOrder', { orderId, deliveryPersonId }, (response) => {
          if (response.status === 'success') {
            // Remove from available orders
            setAvailableOrders(prev => prev.filter(order => order.id !== orderId));
            
            // Add to accepted orders
            const acceptedOrder = availableOrders.find(order => order.id === orderId);
            if (acceptedOrder) {
              const orderWithDetails = {
                ...acceptedOrder,
                status: 'Accepted',
                orderCode: response.data.orderCode,
                pickUpverification: response.data.pickUpVerification
              };
              
              setAcceptedOrders(prev => [...prev, orderWithDetails]);
              setCurrentOrder(orderWithDetails);
            }
            
            // Update count
            setAvailableOrdersCount(prev => Math.max(0, prev - 1));
            
            resolve({ success: true, data: response.data });
          } else {
            reject(new Error(response.message || 'Failed to accept order'));
          }
        });
      });
    } catch (error) {
      console.error('Accept order error:', error);
      return { success: false, error: error.message };
    }
  };

  const verifyPickup = async (orderId, verificationCode) => {
    try {
      // This would typically call an API to verify pickup
      // For now, we'll just update the local state
      setAcceptedOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, status: 'Picked Up' }
            : order
        )
      );
      
      if (currentOrder && currentOrder.id === orderId) {
        setCurrentOrder(prev => ({ ...prev, status: 'Picked Up' }));
      }
      
      return { success: true };
    } catch (error) {
      console.error('Verify pickup error:', error);
      return { success: false, error: error.message };
    }
  };

  const verifyDelivery = async (orderId, verificationCode) => {
    try {
      const response = await orderService.verifyDelivery(orderId, verificationCode, token);
      
      if (response.status === 'success') {
        // Update order status to completed
        setAcceptedOrders(prev => 
          prev.map(order => 
            order.id === orderId 
              ? { ...order, status: 'Completed' }
              : order
          )
        );
        
        if (currentOrder && currentOrder.id === orderId) {
          setCurrentOrder(prev => ({ ...prev, status: 'Completed' }));
        }
        
        return { success: true, message: 'Delivery completed successfully!' };
      } else {
        return { success: false, error: response.message };
      }
    } catch (error) {
      console.error('Verify delivery error:', error);
      return { success: false, error: error.message };
    }
  };

  const refreshAvailableOrders = async () => {
    try {
      // This would typically fetch available orders from API
      // For now, we'll just log the action
      console.log('Refreshing available orders...');
    } catch (error) {
      console.error('Refresh orders error:', error);
    }
  };

  const value = {
    availableOrders,
    acceptedOrders,
    currentOrder,
    availableOrdersCount,
    acceptOrder,
    verifyPickup,
    verifyDelivery,
    refreshAvailableOrders,
    setCurrentOrder,
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};
