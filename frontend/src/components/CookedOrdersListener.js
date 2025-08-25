import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDeliverySocket } from '../sockets/useDeliverySocket';

export default function CookedOrdersListener({ vehicleMethod, onCooked, onAvailableCount }) {
  const handleCooked = useCallback((order) => {
    console.log('🍕 Cooked order received in listener:', order);
    if (onCooked) {
      onCooked(order);
      return;
    }
    const id = order?.orderId || order?.order_id || 'Unknown';
    Alert.alert('New Order Ready! 🍕', `Order ${id} is cooked and ready for pickup!`);
  }, [onCooked]);

  const handleAvailableCount = useCallback((count) => {
    console.log('📊 Available orders count updated:', count);
    if (onAvailableCount) {
      onAvailableCount(count);
    }
  }, [onAvailableCount]);

  useDeliverySocket({ 
    vehicleMethod, 
    onCooked: handleCooked,
    onAvailableCount: handleAvailableCount
  });
  
  return null;
}


