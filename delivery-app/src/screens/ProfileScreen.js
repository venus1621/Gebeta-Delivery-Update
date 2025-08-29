import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  Avatar,
  List,
  Divider,
  Chip,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          onPress: () => {
            logout();
            navigation.replace('Login');
          },
          style: 'destructive'
        },
      ]
    );
  };

  const openPhone = () => {
    if (user?.phone) {
      Linking.openURL(`tel:${user.phone}`).catch(err => {
        Alert.alert('Error', 'Could not open phone app');
      });
    }
  };

  const openEmail = () => {
    if (user?.email) {
      Linking.openURL(`mailto:${user.email}`).catch(err => {
        Alert.alert('Error', 'Could not open email app');
      });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="error" size={64} color="#F44336" />
          <Title style={styles.errorTitle}>User Not Found</Title>
          <Paragraph style={styles.errorText}>
            User information is not available.
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
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              <Avatar.Image
                size={80}
                source={{ uri: user.profilePicture }}
                style={styles.avatar}
              />
              <View style={styles.profileInfo}>
                <Title style={styles.userName}>
                  {user.firstName} {user.lastName}
                </Title>
                <Paragraph style={styles.userRole}>
                  {user.role.replace('_', ' ')}
                </Paragraph>
                <Chip
                  mode="outlined"
                  textStyle={{ color: user.isPhoneVerified ? '#4CAF50' : '#F44336' }}
                  style={[styles.verificationChip, { borderColor: user.isPhoneVerified ? '#4CAF50' : '#F44336' }]}
                >
                  <MaterialIcons 
                    name={user.isPhoneVerified ? 'verified' : 'unverified'} 
                    size={16} 
                    color={user.isPhoneVerified ? '#4CAF50' : '#F44336'} 
                    style={{ marginRight: 4 }}
                  />
                  {user.isPhoneVerified ? 'Phone Verified' : 'Phone Not Verified'}
                </Chip>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Contact Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialIcons name="contact-phone" size={24} color="#2196F3" style={{ marginRight: 8 }} />
              Contact Information
            </Title>
            
            <List.Item
              title="Phone Number"
              description={user.phone}
              left={() => <MaterialIcons name="phone" size={24} color="#2196F3" />}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={openPhone}
                  style={styles.actionButton}
                  icon="phone"
                >
                  Call
                </Button>
              )}
              style={styles.listItem}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Email Address"
              description={user.email}
              left={() => <MaterialIcons name="email" size={24} color="#2196F3" />}
              right={() => (
                <Button
                  mode="outlined"
                  onPress={openEmail}
                  style={styles.actionButton}
                  icon="email"
                >
                  Email
                </Button>
              )}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Account Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialIcons name="account-circle" size={24} color="#4CAF50" style={{ marginRight: 8 }} />
              Account Information
            </Title>
            
            <List.Item
              title="User ID"
              description={user._id}
              left={() => <MaterialIcons name="fingerprint" size={24} color="#4CAF50" />}
              style={styles.listItem}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Account Created"
              description={formatDate(user.createdAt)}
              left={() => <MaterialIcons name="schedule" size={24} color="#4CAF50" />}
              style={styles.listItem}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Last Updated"
              description={formatDate(user.updatedAt)}
              left={() => <MaterialIcons name="update" size={24} color="#4CAF50" />}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* App Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialIcons name="info" size={24} color="#FF9800" style={{ marginRight: 8 }} />
              App Information
            </Title>
            
            <List.Item
              title="App Version"
              description="1.0.0"
              left={() => <MaterialIcons name="android" size={24} color="#FF9800" />}
              style={styles.listItem}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Backend Server"
              description="https://gebeta-delivery1.onrender.com"
              left={() => <MaterialIcons name="dns" size={24} color="#FF9800" />}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Actions</Title>
            
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Home')}
              style={styles.actionButton}
              icon="home"
            >
              Back to Home
            </Button>
            
            <Button
              mode="contained"
              onPress={handleLogout}
              style={[styles.actionButton, styles.logoutButton]}
              icon="logout"
            >
              Logout
            </Button>
          </Card.Content>
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Paragraph style={styles.footerText}>
            Gebeta Delivery App v1.0.0
          </Paragraph>
          <Paragraph style={styles.footerText}>
            © 2025 Gebeta. All rights reserved.
          </Paragraph>
        </View>
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
  profileCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#fff',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  verificationChip: {
    alignSelf: 'flex-start',
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
  listItem: {
    paddingVertical: 8,
  },
  divider: {
    marginVertical: 4,
  },
  actionButton: {
    marginVertical: 4,
    borderColor: '#2196F3',
  },
  actionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  logoutButton: {
    backgroundColor: '#F44336',
    marginTop: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default ProfileScreen;
