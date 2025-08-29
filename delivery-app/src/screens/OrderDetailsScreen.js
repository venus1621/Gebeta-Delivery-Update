import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  Divider,
  TextInput,
  Portal,
  Modal,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const OrderDetailsScreen = ({ route, navigation }) => {
  const { order: routeOrder } = route.params || {};
  const { currentOrder, setCurrentOrder, acceptOrder } = useOrders();
  const { token } = useAuth();
  
  const [order, setOrder] = useState(routeOrder || currentOrder);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);

  useEffect(() => {
    if (routeOrder) {
      setOrder(routeOrder);
    } else if (currentOrder) {
      setOrder(currentOrder);
    }
  }, [routeOrder, currentOrder]);

  const handleAcceptOrder = async () => {
    if (!order) return;
    
    setIsAccepting(true);
    try {
      const result = await acceptOrder(order.id, token);
      
      if (result.success) {
        Alert.alert(
          'Order Accepted! 🎉',
          `Order ${result.data.orderCode} has been accepted successfully.\n\nPickup Code: ${result.data.pickUpverification}`,
          [
            {
              text: 'View Details',
              onPress: () => {
                setShowAcceptModal(false);
                navigation.navigate('PickupVerification', { 
                  order: { ...order, ...result.data } 
                });
              }
            },
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to accept order');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept order. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const openMaps = (lat, lng, label) => {
    const url = Platform.OS === 'ios' 
      ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`
      : `geo:${lat},${lng}?q=${label}`;
    
    Linking.openURL(url).catch(err => {
      Alert.alert('Error', 'Could not open maps app');
    });
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="error" size={64} color="#F44336" />
          <Title style={styles.errorTitle}>Order Not Found</Title>
          <Paragraph style={styles.errorText}>
            The order you're looking for doesn't exist or has been removed.
          </Paragraph>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Order Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.orderHeader}>
              <Title style={styles.orderId}>Order {order.order_id || order.id}</Title>
              <Chip
                mode="outlined"
                textStyle={{ color: getStatusColor(order.status) }}
                style={[styles.statusChip, { borderColor: getStatusColor(order.status) }]}
              >
                {order.status}
              </Chip>
            </View>
            <Paragraph style={styles.orderTime}>
              Created: {formatDate(order.createdAt)}
            </Paragraph>
          </Card.Content>
        </Card>

        {/* Pickup Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialIcons name="restaurant" size={24} color="#FF9800" style={{ marginRight: 8 }} />
              Pickup Location
            </Title>
            <Paragraph style={styles.locationText}>
              {order.restaurantLocation ? 
                `${order.restaurantLocation.lat.toFixed(6)}, ${order.restaurantLocation.lng.toFixed(6)}` : 
                'Location not available'
              }
            </Paragraph>
            <Button
              mode="outlined"
              onPress={() => order.restaurantLocation && 
                openMaps(order.restaurantLocation.lat, order.restaurantLocation.lng, 'Restaurant')}
              style={styles.mapButton}
              icon="map"
              disabled={!order.restaurantLocation}
            >
              Open in Maps
            </Button>
          </Card.Content>
        </Card>

        {/* Delivery Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialIcons name="location-on" size={24} color="#2196F3" style={{ marginRight: 8 }} />
              Delivery Location
            </Title>
            <Paragraph style={styles.locationText}>
              {order.deliveryLocation ? 
                `${order.deliveryLocation.lat.toFixed(6)}, ${order.deliveryLocation.lng.toFixed(6)}` : 
                'Location not available'
              }
            </Paragraph>
            <Button
              mode="outlined"
              onPress={() => order.deliveryLocation && 
                openMaps(order.deliveryLocation.lat, order.deliveryLocation.lng, 'Delivery Address')}
              style={styles.mapButton}
              icon="map"
              disabled={!order.deliveryLocation}
            >
              Open in Maps
            </Button>
          </Card.Content>
        </Card>

        {/* Payment Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialIcons name="payment" size={24} color="#4CAF50" style={{ marginRight: 8 }} />
              Payment Details
            </Title>
            
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
            
            <Divider style={styles.divider} />
            
            <View style={styles.paymentRow}>
              <Paragraph style={[styles.paymentLabel, styles.totalLabel]}>Total:</Paragraph>
              <Paragraph style={[styles.paymentAmount, styles.totalAmount]}>
                {formatCurrency(order.grandTotal || (Number(order.deliveryFee) + Number(order.tip || 0)))}
              </Paragraph>
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        {order.status === 'Cooked' && (
          <Card style={styles.actionCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Ready to Accept?</Title>
              <Paragraph style={styles.actionText}>
                This order is ready for pickup. Accept it to start your delivery.
              </Paragraph>
              <Button
                mode="contained"
                onPress={() => setShowAcceptModal(true)}
                style={styles.acceptButton}
                icon="check"
                loading={isAccepting}
                disabled={isAccepting}
              >
                {isAccepting ? 'Accepting...' : 'Accept Order'}
              </Button>
            </Card.Content>
          </Card>
        )}

        {order.status === 'Accepted' && (
          <Card style={styles.actionCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Order Accepted</Title>
              <Paragraph style={styles.actionText}>
                Order Code: {order.orderCode || 'N/A'}{'\n'}
                Pickup Code: {order.pickUpverification || 'N/A'}
              </Paragraph>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('PickupVerification', { order })}
                style={styles.verifyButton}
                icon="verified-user"
              >
                Verify Pickup
              </Button>
            </Card.Content>
          </Card>
        )}

        {order.status === 'Picked Up' && (
          <Card style={styles.actionCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Order Picked Up</Title>
              <Paragraph style={styles.actionText}>
                You've successfully picked up the order. Head to the delivery location.
              </Paragraph>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('DeliveryVerification', { order })}
                style={styles.verifyButton}
                icon="delivery-dining"
              >
                Verify Delivery
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Accept Order Modal */}
      <Portal>
        <Modal
          visible={showAcceptModal}
          onDismiss={() => setShowAcceptModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Title style={styles.modalTitle}>Confirm Order Acceptance</Title>
          <Paragraph style={styles.modalText}>
            Are you sure you want to accept this order?{'\n\n'}
            Order: {order.order_id || order.id}{'\n'}
            Total: {formatCurrency(order.grandTotal || (Number(order.deliveryFee) + Number(order.tip || 0)))}
          </Paragraph>
          
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowAcceptModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAcceptOrder}
              style={[styles.modalButton, styles.confirmButton]}
              loading={isAccepting}
              disabled={isAccepting}
            >
              Accept
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: '#F44336',
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  backButton: {
    backgroundColor: '#2196F3',
  },
  headerCard: {
    marginBottom: 16,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusChip: {
    height: 36,
  },
  orderTime: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  mapButton: {
    marginTop: 8,
    borderColor: '#2196F3',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  paymentAmount: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  divider: {
    marginVertical: 12,
  },
  actionCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#e8f5e8',
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    lineHeight: 22,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
  },
  verifyButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
});

export default OrderDetailsScreen;
