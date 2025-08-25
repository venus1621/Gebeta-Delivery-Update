import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function CookedOrderModal({ visible, order, onAccept, onDecline, onClose }) {
  if (!order) return null;
  const id = order?.orderId || order?.order_id || 'Unknown';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Cooked Order</Text>
          <Text style={styles.subtitle}>Order {id} is ready for pickup</Text>
          <View style={styles.row}><Text>Grand Total: </Text><Text style={styles.bold}>{order?.grandTotal ?? '-' } ETB</Text></View>
          <View style={styles.row}><Text>Delivery Fee: </Text><Text style={styles.bold}>{order?.deliveryFee ?? '-' } ETB</Text></View>
          <View style={styles.row}><Text>Tip: </Text><Text style={styles.bold}>{order?.tip ?? 0 } ETB</Text></View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.accept]} onPress={onAccept}>
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.decline]} onPress={onDecline}>
              <Text style={styles.buttonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bold: { fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  accept: { backgroundColor: '#10b981', marginRight: 8 },
  decline: { backgroundColor: '#ef4444', marginLeft: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
});


