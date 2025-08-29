import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  FAB,
  Badge,
  Chip,
  Divider,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import OrderCard from '../components/OrderCard';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const {
    availableOrders,
    acceptedOrders,
    availableOrdersCount,
    refreshAvailableOrders,
  } = useOrders();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('available'); // 'available' or 'accepted'

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAvailableOrders();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout },
      ]
    );
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

  const renderAvailableOrders = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Title style={styles.sectionTitle}>
          Available Orders
          <Badge style={styles.badge}>{availableOrdersCount}</Badge>
        </Title>
        <Chip
          mode="outlined"
          textStyle={{ color: '#2196F3' }}
          style={styles.refreshChip}
        >
          Pull to refresh
        </Chip>
      </View>
      
      {availableOrders.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyText}>No orders available</Text>
            <Text style={styles.emptySubtext}>
              New orders will appear here when restaurants finish cooking
            </Text>
          </Card.Content>
        </Card>
      ) : (
        availableOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            type="available"
            onAccept={() => navigation.navigate('OrderDetails', { order })}
          />
        ))
      )}
    </View>
  );

  const renderAcceptedOrders = () => (
    <View style={styles.section}>
      <Title style={styles.sectionTitle}>Accepted Orders</Title>
      
      {acceptedOrders.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyText}>No accepted orders</Text>
            <Text style={styles.emptySubtext}>
              Accept orders from the Available tab to see them here
            </Text>
          </Card.Content>
        </Card>
      ) : (
        acceptedOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            type="accepted"
            onPress={() => navigation.navigate('OrderDetails', { order })}
          />
        ))
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userRole}>{user?.role}</Text>
        </View>
        
        <Button
          mode="outlined"
          onPress={() => navigation.navigate('Profile')}
          style={styles.profileButton}
        >
          Profile
        </Button>
      </View>

      <View style={styles.tabContainer}>
        <Button
          mode={activeTab === 'available' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('available')}
          style={styles.tabButton}
        >
          Available ({availableOrdersCount})
        </Button>
        <Button
          mode={activeTab === 'accepted' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('accepted')}
          style={styles.tabButton}
        >
          Accepted ({acceptedOrders.length})
        </Button>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'available' ? renderAvailableOrders() : renderAcceptedOrders()}
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('OrderDetails')}
        label="New Order"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  profileButton: {
    marginLeft: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  badge: {
    marginLeft: 10,
    backgroundColor: '#FF5722',
  },
  refreshChip: {
    borderColor: '#2196F3',
  },
  emptyCard: {
    backgroundColor: '#fafafa',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emptyContent: {
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
});

export default HomeScreen;
