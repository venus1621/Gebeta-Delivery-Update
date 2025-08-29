import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Vibration,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  Chip,
  Divider,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useOrders } from '../context/OrderContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const PickupVerificationScreen = ({ route, navigation }) => {
  const { order: routeOrder } = route.params || {};
  const { verifyPickup } = useOrders();
  
  const [order] = useState(routeOrder);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

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

  const handleVerification = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (verificationCode !== order.pickUpverification) {
      Alert.alert('Error', 'Invalid verification code. Please check with the restaurant.');
      Vibration.vibrate(500);
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifyPickup(order.id, verificationCode);
      
      if (result.success) {
        setIsVerified(true);
        Vibration.vibrate([100, 100, 100]);
        Alert.alert(
          'Pickup Verified! ✅',
          'You have successfully verified pickup with the restaurant. You can now proceed with the delivery.',
          [
            {
              text: 'Continue to Delivery',
              onPress: () => {
                navigation.navigate('DeliveryVerification', { order: { ...order, status: 'Picked Up' } });
              }
            },
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to verify pickup');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify pickup. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerContent}>
              <MaterialIcons name="restaurant" size={48} color="#FF9800" />
              <View style={styles.headerText}>
                <Title style={styles.title}>Pickup Verification</Title>
                <Paragraph style={styles.subtitle}>
                  Verify pickup with the restaurant
                </Paragraph>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Order Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Order Details</Title>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order ID:</Text>
              <Text style={styles.infoValue}>{order.order_id || order.id}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Code:</Text>
              <Text style={styles.infoValue}>{order.orderCode || 'N/A'}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created:</Text>
              <Text style={styles.infoValue}>{formatDate(order.createdAt)}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Amount:</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(order.grandTotal || (Number(order.deliveryFee) + Number(order.tip || 0)))}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Verification Code */}
        <Card style={styles.verificationCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Verification Code</Title>
            <Paragraph style={styles.verificationText}>
              Ask the restaurant staff for the pickup verification code and enter it below.
            </Paragraph>
            
            <View style={styles.codeDisplay}>
              <Text style={styles.codeLabel}>Expected Code:</Text>
              <Chip
                mode="outlined"
                textStyle={{ fontSize: 18, fontWeight: 'bold', color: '#2196F3' }}
                style={styles.codeChip}
              >
                {order.pickUpverification || 'N/A'}
              </Chip>
            </View>
            
            <TextInput
              label="Enter Verification Code"
              value={verificationCode}
              onChangeText={setVerificationCode}
              mode="outlined"
              style={styles.codeInput}
              keyboardType="numeric"
              maxLength={6}
              autoFocus
            />
            
            <Button
              mode="contained"
              onPress={handleVerification}
              style={styles.verifyButton}
              icon="check"
              loading={isVerifying}
              disabled={isVerifying || !verificationCode.trim()}
            >
              {isVerifying ? 'Verifying...' : 'Verify Pickup'}
            </Button>
          </Card.Content>
        </Card>

        {/* Instructions */}
        <Card style={styles.instructionsCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Instructions</Title>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="1" size={24} color="#2196F3" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Go to the restaurant</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Navigate to the pickup location shown in the order details
                </Paragraph>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="2" size={24} color="#2196F3" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Ask for verification code</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Request the pickup verification code from restaurant staff
                </Paragraph>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="3" size={24} color="#2196F3" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Enter the code</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Input the code above and tap "Verify Pickup"
                </Paragraph>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="4" size={24} color="#4CAF50" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Collect the order</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Once verified, collect the order and proceed to delivery
                </Paragraph>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Success Message */}
        {isVerified && (
          <Card style={styles.successCard}>
            <Card.Content>
              <View style={styles.successContent}>
                <MaterialIcons name="check-circle" size={48} color="#4CAF50" />
                <Title style={styles.successTitle}>Pickup Verified!</Title>
                <Paragraph style={styles.successText}>
                  You have successfully verified pickup with the restaurant. 
                  You can now collect the order and proceed with delivery.
                </Paragraph>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('DeliveryVerification', { 
                    order: { ...order, status: 'Picked Up' } 
                  })}
                  style={styles.continueButton}
                  icon="delivery-dining"
                >
                  Continue to Delivery
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
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
    backgroundColor: '#fff3e0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
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
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  verificationCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#e3f2fd',
  },
  verificationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    lineHeight: 22,
  },
  codeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  codeChip: {
    height: 40,
    borderColor: '#2196F3',
  },
  codeInput: {
    marginBottom: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 2,
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
  },
  instructionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  instructionText: {
    flex: 1,
    marginLeft: 12,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  instructionDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  successCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#e8f5e8',
  },
  successContent: {
    alignItems: 'center',
    padding: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  continueButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
  },
});

export default PickupVerificationScreen;
