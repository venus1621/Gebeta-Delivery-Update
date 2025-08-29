import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import OrderDetailsScreen from './src/screens/OrderDetailsScreen';
import PickupVerificationScreen from './src/screens/PickupVerificationScreen';
import DeliveryVerificationScreen from './src/screens/DeliveryVerificationScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Import context
import { AuthProvider } from './src/context/AuthContext';
import { OrderProvider } from './src/context/OrderContext';

const Stack = createStackNavigator();

const theme = {
  colors: {
    primary: '#2196F3',
    accent: '#FF9800',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#212121',
    error: '#F44336',
    success: '#4CAF50',
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <OrderProvider>
            <NavigationContainer>
              <StatusBar style="auto" />
              <Stack.Navigator
                initialRouteName="Login"
                screenOptions={{
                  headerStyle: {
                    backgroundColor: theme.colors.primary,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              >
                <Stack.Screen 
                  name="Login" 
                  component={LoginScreen} 
                  options={{ headerShown: false }}
                />
                <Stack.Screen 
                  name="Home" 
                  component={HomeScreen} 
                  options={{ title: 'Gebeta Delivery' }}
                />
                <Stack.Screen 
                  name="OrderDetails" 
                  component={OrderDetailsScreen} 
                  options={{ title: 'Order Details' }}
                />
                <Stack.Screen 
                  name="PickupVerification" 
                  component={PickupVerificationScreen} 
                  options={{ title: 'Pickup Verification' }}
                />
                <Stack.Screen 
                  name="DeliveryVerification" 
                  component={DeliveryVerificationScreen} 
                  options={{ title: 'Delivery Verification' }}
                />
                <Stack.Screen 
                  name="Profile" 
                  component={ProfileScreen} 
                  options={{ title: 'Profile' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </OrderProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
