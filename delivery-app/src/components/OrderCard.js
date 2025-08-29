import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Divider } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

const OrderCard = ({ order, type, onAccept, onPress }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Cooked':
        return '#FF9800';
      case 'Accepted':
        return '#2196F3';
      case 'Picked Up':
        return '#9C27B0';
      case 'Delivering':
        return '#FF5722';
      case 'Completed':
        return '#4CAF50';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Cooked':
        return 'restaurant';
      case 'Accepted':
        return 'check-circle';
      case 'Picked Up':
        return 'local-shipping';
      case 'Delivering':
        return 'directions-car';
      case 'Completed':
        return 'done-all';
      default:
        return 'info';
    }
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderOrderInfo = () => (
    <View style={styles.orderInfo}>
      <View style={styles.orderHeader}>
        <Title style={styles.orderId}>Order {order.order_id || order.id}</Title>
        <Chip
          mode="outlined"
          textStyle={{ color: getStatusColor(order.status) }}
          style={[styles.statusChip, { borderColor: getStatusColor(order.status) }]}
        >
          <MaterialIcons 
            name={getStatusIcon(order.status)} 
            size={16} 
            color={getStatusColor(order.status)} 
            style={{ marginRight: 4 }}
          />
          {order.status}
        </Chip>
      </View>
      
      <Paragraph style={styles.orderTime}>
        Created: {formatDate(order.createdAt)}
      </Paragraph>
    </View>
  );

  const renderLocationInfo = () => (
    <View style={styles.locationInfo}>
      <View style={styles.locationRow}>
        <MaterialIcons name="restaurant" size={20} color="#FF9800" />
        <View style={styles.locationText}>
          <Paragraph style={styles.locationLabel}>Pickup from:</Paragraph>
          <Paragraph style={styles.locationAddress}>
            {order.restaurantLocation ? 
              `${order.restaurantLocation.lat.toFixed(4)}, ${order.restaurantLocation.lng.toFixed(4)}` : 
              'Location not available'
            }
          </Paragraph>
        </View>
      </View>
      
      <View style={styles.locationRow}>
        <MaterialIcons name="location-on" size={20} color="#2196F3" />
        <View style={styles.locationText}>
          <Paragraph style={styles.locationLabel}>Deliver to:</Paragraph>
          <Paragraph style={styles.locationAddress}>
            {order.deliveryLocation ? 
              `${order.deliveryLocation.lat.toFixed(4)}, ${order.deliveryLocation.lng.toFixed(4)}` : 
              'Location not available'
            }
          </Paragraph>
        </View>
      </View>
    </View>
  );

  const renderPaymentInfo = () => (
    <View style={styles.paymentInfo}>
      <Divider style={styles.divider} />
      <View style={styles.paymentRow}>
        <Paragraph style={styles.paymentLabel}>Delivery Fee:</Paragraph>
        <Paragraph style={styles.paymentAmount}>
          {formatCurrency(order.deliveryFee)}
        </Paragraph>
      </View>
      
      {order.tip && (
        <View style={styles.paymentRow}>
          <Paragraph style={styles.paymentLabel}>Tip:</Paragraph>
          <Paragraph style={styles.paymentAmount}>
            {formatCurrency(order.tip)}
          </Paragraph>
        </View>
      )}
      
      <View style={styles.paymentRow}>
        <Paragraph style={styles.paymentLabel}>Total:</Paragraph>
        <Paragraph style={[styles.paymentAmount, styles.totalAmount]}>
          {formatCurrency(order.grandTotal || (Number(order.deliveryFee) + Number(order.tip || 0)))}
        </Paragraph>
      </View>
    </View>
  );

  const renderActions = () => {
    if (type === 'available') {
      return (
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={onAccept}
            style={styles.acceptButton}
            icon="check"
          >
            Accept Order
          </Button>
        </View>
      );
    }
    
    if (type === 'accepted') {
      return (
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={onPress}
            style={styles.viewButton}
            icon="eye"
          >
            View Details
          </Button>
        </View>
      );
    }
    
    return null;
  };

  return (
    <Card style={styles.card} onPress={type === 'accepted' ? onPress : undefined}>
      <Card.Content>
        {renderOrderInfo()}
        {renderLocationInfo()}
        {renderPaymentInfo()}
        {renderActions()}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  orderInfo: {
    marginBottom: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusChip: {
    height: 32,
  },
  orderTime: {
    fontSize: 12,
    color: '#666',
  },
  locationInfo: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationText: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  paymentInfo: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentAmount: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  actions: {
    marginTop: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  viewButton: {
    borderColor: '#2196F3',
  },
});

export default OrderCard;
