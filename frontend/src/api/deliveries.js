import { api } from './client';

// POST /api/v1/deliveries  (assign/accept)
export async function acceptOrder({ orderId }) {
  try {
    const { data } = await api.post('/api/v1/deliveries', { orderId });
    return data;
  } catch (error) {
    console.error('Error accepting order:', error);
    throw error;
  }
}

// POST /api/v1/deliveries/cancel  (decline/cancel)
export async function declineOrder({ orderId }) {
  try {
    const { data } = await api.post('/api/v1/deliveries/cancel', { orderId });
    return data;
  } catch (error) {
    console.error('Error declining order:', error);
    throw error;
  }
}

// GET /api/v1/orders/available-cooked (get all available cooked orders)
export async function getAvailableCookedOrders() {
  try {
    const { data } = await api.get('/api/v1/orders/available-cooked');
    return data;
  } catch (error) {
    console.error('Error fetching available orders:', error);
    throw error;
  }
}

// GET /api/v1/orders/available-cooked/count (get count of available orders)
export async function getAvailableCookedOrdersCount() {
  try {
    const { data } = await api.get('/api/v1/orders/available-cooked/count');
    return data;
  } catch (error) {
    console.error('Error fetching available orders count:', error);
    throw error;
  }
}


