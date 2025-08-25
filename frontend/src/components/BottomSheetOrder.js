import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
import { playCookedSound } from '../utils/sound';

export default function BottomSheetOrder({ visible, order, onAccept, onDecline }) {
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      playCookedSound().catch(() => {});
    } else {
      Animated.timing(translateY, {
        toValue: 300,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  if (!order) return null;
  
  const id = order?.orderId || order?.order_id || 'Unknown';
  const customerName = order?.customer?.name || 'Customer';
  const customerPhone = order?.customer?.phone || 'N/A';

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>
      
      <View style={styles.header}>
        <Text style={styles.title}>New Order Ready! 🍕</Text>
        <Text style={styles.subtitle}>Order {id} is cooked</Text>
      </View>
      
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <Text style={styles.detail}>Name: {customerName}</Text>
          <Text style={styles.detail}>Phone: {customerPhone}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.row}>
            <Text>Grand Total: </Text>
            <Text style={styles.bold}>{order?.grandTotal ?? '-'} ETB</Text>
          </View>
          <View style={styles.row}>
            <Text>Delivery Fee: </Text>
            <Text style={styles.bold}>{order?.deliveryFee ?? '-'} ETB</Text>
          </View>
          <View style={styles.row}>
            <Text>Tip: </Text>
            <Text style={styles.bold}>{order?.tip ?? 0} ETB</Text>
          </View>
        </View>

        {order?.items && order.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Food Items</Text>
            {order.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.foodName}</Text>
                <Text style={styles.itemDetails}>x{item.quantity} - {item.price} ETB</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Details</Text>
          <View style={styles.row}> 
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>Restaurant</Text>
              <Text style={styles.coordinates}>lat: {order?.restaurantLocation?.lat?.toFixed(6) ?? '-'}</Text>
              <Text style={styles.coordinates}>lng: {order?.restaurantLocation?.lng?.toFixed(6) ?? '-'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>Destination</Text>
              <Text style={styles.coordinates}>lat: {order?.deliveryLocation?.lat?.toFixed(6) ?? '-'}</Text>
              <Text style={styles.coordinates}>lng: {order?.deliveryLocation?.lng?.toFixed(6) ?? '-'}</Text>
            </View>
          </View>
        </View>

        {order?.createdAt && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Time</Text>
            <Text style={styles.detail}>{new Date(order.createdAt).toLocaleString()}</Text>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.accept]} onPress={onAccept}>
          <Text style={styles.buttonText}>Accept Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.decline]} onPress={onDecline}>
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    maxHeight: '70%',
  },
  handleContainer: { alignItems: 'center', marginBottom: 8 },
  handle: { width: 44, height: 5, borderRadius: 2.5, backgroundColor: '#e5e7eb' },
  header: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  scrollArea: { flexGrow: 0, maxHeight: 400 },
  scrollContent: { paddingBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#374151' },
  detail: { fontSize: 14, color: '#4b5563', marginBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 6, justifyContent: 'space-between' },
  bold: { fontWeight: '700', color: '#1f2937' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemName: { fontSize: 14, color: '#4b5563', flex: 1 },
  itemDetails: { fontSize: 14, color: '#6b7280' },
  locationTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#374151' },
  coordinates: { fontSize: 12, color: '#6b7280', fontFamily: 'monospace' },
  actions: { flexDirection: 'row', marginTop: 16 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  accept: { backgroundColor: '#10b981', marginRight: 8 },
  decline: { backgroundColor: '#ef4444', marginLeft: 8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});


