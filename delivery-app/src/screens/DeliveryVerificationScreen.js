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
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useOrders } from '../context/OrderContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const DeliveryVerificationScreen = ({ route, navigation }) => {
  const { order: routeOrder } = route.params || {};
  const { verifyDelivery } = useOrders();
  
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

    setIsVerifying(true);
    try {
      const result = await verifyDelivery(order.order_id || order.id, verificationCode);
      
      if (result.success) {
        setIsVerified(true);
        Vibration.vibrate([100, 100, 100]);
        Alert.alert(
          'Delivery Completed! 🎉',
          result.message || 'You have successfully completed the delivery!',
          [
            {
              text: 'Back to Home',
              onPress: () => {
                navigation.navigate('Home');
              }
            },
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to verify delivery');
        Vibration.vibrate(500);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify delivery. Please try again.');
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
              <MaterialIcons name="delivery-dining" size={48} color="#4CAF50" />
              <View style={styles.headerText}>
                <Title style={styles.title}>Delivery Verification</Title>
                <Paragraph style={styles.subtitle}>
                  Verify delivery completion with customer
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

        {/* Delivery Location */}
        <Card style={styles.locationCard}>
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
            <Paragraph style={styles.locationNote}>
              Make sure you have arrived at the correct delivery location before proceeding with verification.
            </Paragraph>
          </Card.Content>
        </Card>

        {/* Verification Code */}
        <Card style={styles.verificationCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Customer Verification</Title>
            <Paragraph style={styles.verificationText}>
              Ask the customer for the delivery verification code and enter it below to complete the delivery.
            </Paragraph>
            
            <TextInput
              label="Enter Verification Code"
              value={verificationCode}
              onChangeText={setVerificationCode}
              mode="outlined"
              style={styles.codeInput}
              keyboardType="numeric"
              maxLength={6}
              autoFocus
              placeholder="Enter 6-digit code"
            />
            
            <Button
              mode="contained"
              onPress={handleVerification}
              style={styles.verifyButton}
              icon="check"
              loading={isVerifying}
              disabled={isVerifying || !verificationCode.trim()}
            >
              {isVerifying ? 'Verifying...' : 'Complete Delivery'}
            </Button>
          </Card.Content>
        </Card>

        {/* Instructions */}
        <Card style={styles.instructionsCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Delivery Instructions</Title>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="1" size={24} color="#2196F3" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Arrive at location</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Navigate to the delivery address shown in the order details
                </Paragraph>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="2" size={24} color="#2196F3" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Contact customer</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Call or message the customer to arrange delivery
                </Paragraph>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="3" size={24} color="#2196F3" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Hand over order</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Safely deliver the order to the customer
                </Paragraph>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="4" size={24} color="#4CAF50" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Get verification code</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Ask the customer for the delivery verification code
                </Paragraph>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <MaterialIcons name="5" size={24} color="#FF9800" />
              <View style={styles.instructionText}>
                <Paragraph style={styles.instructionTitle}>Complete delivery</Paragraph>
                <Paragraph style={styles.instructionDesc}>
                  Enter the code above and tap "Complete Delivery"
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
                <Title style={styles.successTitle}>Delivery Completed!</Title>
                <Paragraph style={styles.successText}>
                  Congratulations! You have successfully completed the delivery. 
                  The order has been marked as completed and you can now return to the home screen.
                </Paragraph>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('Home')}
                  style={styles.homeButton}
                  icon="home"
                >
                  Back to Home
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Tips */}
        <Card style={styles.tipsCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialIcons name="lightbulb" size={24} color="#FF9800" style={{ marginRight: 8 }} />
              Delivery Tips
            </Title>
            
            <View style={styles.tipItem}>
              <MaterialIcons name="check" size={20} color="#4CAF50" />
              <Paragraph style={styles.tipText}>
                Always verify the customer's identity before handing over the order
              </Paragraph>
            </View>
            
            <View style={styles.tipItem}>
              <MaterialIcons name="check" size={20} color="#4CAF50" />
              <Paragraph style={styles.tipText}>
                Handle the order with care to maintain food quality
              </Paragraph>
            </View>
            
            <View style={styles.tipItem}>
              <MaterialIcons name="check" size={20} color="#4CAF50" />
              <Paragraph style={styles.tipText}>
                Be polite and professional during delivery
              </Paragraph>
            </View>
            
            <View style={styles.tipItem}>
              <MaterialIcons name="check" size={20} color="#4CAF50" />
              <Paragraph style={styles.tipText}>
                Take a photo if required for proof of delivery
              </Paragraph>
            </View>
          </Card.Content>
        </Card>
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
    backgroundColor: '#e8f5e8',
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
    color: '#4CAF50',
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
    flexDirection: 'row',
    alignItems: 'center',
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
  locationCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#e3f2fd',
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  locationNote: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  verificationCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#fff3e0',
  },
  verificationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    lineHeight: 22,
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
  homeButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
  },
  tipsCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#fff8e1',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default DeliveryVerificationScreen;
