import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, FlatList, Alert, TouchableOpacity } from 'react-native';
import React, { useState, useCallback, useEffect } from 'react';
import CookedOrdersListener from './src/components/CookedOrdersListener';
import BottomSheetOrder from './src/components/BottomSheetOrder';
import { playCookedSound } from './src/utils/sound';
import { acceptOrder, declineOrder, getAvailableCookedOrders } from './src/api/deliveries';
import MapScreen from './src/screens/MapScreen';
import { fetchRoutePolyline, decodePolyline6 } from './src/utils/osrm';

export default function App() {
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Load initial available orders
  useEffect(() => {
    loadAvailableOrders();
  }, []);

  const loadAvailableOrders = async () => {
    try {
      setIsLoading(true);
      const response = await getAvailableCookedOrders();
      if (response.status === 'success') {
        setOrders(response.data || []);
        setAvailableCount(response.results || 0);
      }
    } catch (error) {
      console.error('Failed to load available orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onCooked = useCallback((order) => {
    console.log('🍕 New cooked order received:', order);
    
    // Add to orders list (newest at top)
    setOrders((prev) => [order, ...prev]);
    
    // Set as active order for map and modal
    setActiveOrder(order);
    
    // Play sound notification
    playCookedSound().catch(() => {});
    
    // Update count
    setAvailableCount((prev) => prev + 1);
  }, []);

  const onAvailableCount = useCallback((count) => {
    console.log('📊 Available count updated:', count);
    setAvailableCount(count);
  }, []);

  // Handle route calculation when active order changes
  useEffect(() => {
    setModalVisible(Boolean(activeOrder));
    
    if (activeOrder?.restaurantLocation && activeOrder?.deliveryLocation) {
      calculateRoute();
    }
  }, [activeOrder]);

  const calculateRoute = async () => {
    try {
      const route = await fetchRoutePolyline({
        origin: activeOrder.restaurantLocation,
        destination: activeOrder.deliveryLocation,
        mode: 'driving',
      });
      const coords = decodePolyline6(route?.polyline);
      setRouteCoords(coords);
    } catch (error) {
      console.error('Failed to calculate route:', error);
      setRouteCoords([]);
    }
  };

  const handleAccept = useCallback(async () => {
    if (!activeOrder) return;
    
    const orderId = activeOrder?.orderId || activeOrder?.order_id;
    try {
      await acceptOrder({ orderId });
      
      // Remove from available orders
      setOrders((prev) => prev.filter(order => 
        (order?.orderId || order?.order_id) !== orderId
      ));
      
      // Clear active order
      setActiveOrder(null);
      
      // Update count
      setAvailableCount((prev) => Math.max(0, prev - 1));
      
      Alert.alert('✅ Order Accepted', `You accepted order ${orderId}`);
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to accept order. Please try again.');
    }
  }, [activeOrder]);

  const handleDecline = useCallback(async () => {
    if (!activeOrder) return;
    
    const orderId = activeOrder?.orderId || activeOrder?.order_id;
    try {
      await declineOrder({ orderId });
      
      // Remove from available orders
      setOrders((prev) => prev.filter(order => 
        (order?.orderId || order?.order_id) !== orderId
      ));
      
      // Clear active order
      setActiveOrder(null);
      
      // Update count
      setAvailableCount((prev) => Math.max(0, prev - 1));
      
      Alert.alert('❌ Order Declined', `You declined order ${orderId}`);
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to decline order. Please try again.');
    }
  }, [activeOrder]);

  const renderOrderItem = ({ item, index }) => {
    const id = item?.orderId || item?.order_id || 'Unknown';
    const customerName = item?.customer?.name || 'Customer';
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Order {id}</Text>
          <Text style={styles.customerName}>{customerName}</Text>
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.price}>Total: {item?.grandTotal ?? '-'} ETB</Text>
          <Text style={styles.deliveryFee}>Delivery: {item?.deliveryFee ?? '-'} ETB</Text>
          <Text style={styles.tip}>Tip: {item?.tip ?? 0} ETB</Text>
        </View>
        
        {item?.items && item.items.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsTitle}>Items:</Text>
            {item.items.slice(0, 2).map((foodItem, idx) => (
              <Text key={idx} style={styles.itemText}>
                • {foodItem.foodName} x{foodItem.quantity}
              </Text>
            ))}
            {item.items.length > 2 && (
              <Text style={styles.moreItems}>+{item.items.length - 2} more items</Text>
            )}
          </View>
        )}
        
        <Text style={styles.time}>
          {item?.createdAt ? new Date(item.createdAt).toLocaleTimeString() : 'N/A'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <CookedOrdersListener 
        onCooked={onCooked} 
        onAvailableCount={onAvailableCount}
      />
      
      <View style={styles.mapContainer}>
        <MapScreen
          restaurantLocation={activeOrder?.restaurantLocation}
          deliveryLocation={activeOrder?.deliveryLocation}
          routeCoords={routeCoords}
        />
      </View>

      <BottomSheetOrder
        visible={modalVisible}
        order={activeOrder}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Available Orders</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{availableCount}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={loadAvailableOrders}
          disabled={isLoading}
        >
          <Text style={styles.refreshButtonText}>
            {isLoading ? 'Loading...' : '🔄 Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => (item?.orderId || item?.order_id || String(Date.now()))}
        renderItem={renderOrderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Orders Available</Text>
            <Text style={styles.emptySubtitle}>
              {isLoading ? 'Loading orders...' : 'Waiting for cooked orders to arrive'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  mapContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  countBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  customerName: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  cardContent: {
    marginBottom: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  deliveryFee: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 2,
  },
  tip: {
    fontSize: 14,
    color: '#475569',
  },
  itemsSection: {
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  moreItems: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  time: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
