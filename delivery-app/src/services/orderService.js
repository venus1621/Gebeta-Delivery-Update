const BASE_URL = 'https://gebeta-delivery1.onrender.com/api/v1';

class OrderService {
  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${BASE_URL}${endpoint}`;
      
      const defaultOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      const response = await fetch(url, defaultOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  async acceptOrder(orderId, token) {
    return this.makeRequest('/orders/accept-for-delivery', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });
  }

  async verifyDelivery(orderId, verificationCode, token) {
    return this.makeRequest('/orders/verify-delivery', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        order_id: orderId, 
        verification_code: verificationCode 
      }),
    });
  }

  async getOrderDetails(orderId, token) {
    return this.makeRequest(`/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  async updateOrderStatus(orderId, status, token) {
    return this.makeRequest('/orders/update-status', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, status }),
    });
  }

  async getAvailableOrders(token) {
    return this.makeRequest('/orders/available-for-delivery', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  async getAcceptedOrders(token) {
    return this.makeRequest('/orders/accepted-by-delivery', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }
}

export const orderService = new OrderService();
