import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const LoginScreen = ({ navigation }) => {
  const { login, isLoading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('adminuser@example.com');
  const [password, setPassword] = useState('password123');

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, navigation]);

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Please fill in all fields');
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      navigation.replace('Home');
    } else {
      alert(result.error || 'Login failed');
    }
  };

  const handleDemoLogin = async () => {
    const result = await login('adminuser@example.com', 'password123');
    if (result.success) {
      navigation.replace('Home');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: 'https://res.cloudinary.com/drinuph9d/image/upload/v1752830842/800px-User_icon_2.svg_vi5e9d.png' }}
              style={styles.logo}
            />
            <Title style={styles.title}>Gebeta Delivery</Title>
            <Paragraph style={styles.subtitle}>
              Your trusted delivery partner
            </Paragraph>
          </View>

          <Card style={styles.loginCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Welcome Back!</Title>
              
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                disabled={isLoading}
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                style={styles.input}
                secureTextEntry
                disabled={isLoading}
              />

              <Button
                mode="contained"
                onPress={handleLogin}
                style={styles.loginButton}
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>

              <Button
                mode="outlined"
                onPress={handleDemoLogin}
                style={styles.demoButton}
                disabled={isLoading}
              >
                Demo Login
              </Button>
            </Card.Content>
          </Card>

          <View style={styles.infoContainer}>
            <Paragraph style={styles.infoText}>
              Demo Credentials:
            </Paragraph>
            <Paragraph style={styles.credentials}>
              Email: adminuser@example.com{'\n'}
              Password: password123
            </Paragraph>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    borderRadius: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loginCard: {
    marginBottom: 30,
    elevation: 4,
  },
  cardTitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  input: {
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 8,
  },
  demoButton: {
    marginBottom: 8,
  },
  infoContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
  },
  infoText: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976d2',
  },
  credentials: {
    textAlign: 'center',
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default LoginScreen;
