import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Static token for development (as provided in requirements)
  const STATIC_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YWM2MWY4Mjk0NjUzOTE2Zjg0MDZlNiIsImlhdCI6MTc1NjI4MDU2MSwiZXhwIjoxNzY0MDU2NTYxfQ.2zdqg4FUHweElmhv9oBv0h3BKzNiXTP3VZ70o9lSXT0";

  // Static user data for development
  const STATIC_USER = {
    "_id": "68ac61f8294653916f8406e6",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+251911111111",
    "email": "adminuser@example.com",
    "profilePicture": "https://res.cloudinary.com/drinuph9d/image/upload/v1752830842/800px-User_icon_2.svg_vi5e9d.png",
    "role": "Delivery_Person",
    "isPhoneVerified": true,
    "addresses": [],
    "createdAt": "2025-08-25T13:15:36.211Z",
    "updatedAt": "2025-08-25T13:15:36.211Z",
    "__v": 0
  };

  useEffect(() => {
    // Auto-login with static credentials for development
    autoLogin();
  }, []);

  const autoLogin = async () => {
    try {
      setIsLoading(true);
      
      // For development, use static credentials
      setToken(STATIC_TOKEN);
      setUser(STATIC_USER);
      
      // Store in secure storage
      await SecureStore.setItemAsync('userToken', STATIC_TOKEN);
      await AsyncStorage.setItem('userData', JSON.stringify(STATIC_USER));
      
    } catch (error) {
      console.error('Auto-login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      
      // For development, use static credentials
      setToken(STATIC_TOKEN);
      setUser(STATIC_USER);
      
      // Store in secure storage
      await SecureStore.setItemAsync('userToken', STATIC_TOKEN);
      await AsyncStorage.setItem('userData', JSON.stringify(STATIC_USER));
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setToken(null);
      setUser(null);
      
      // Clear storage
      await SecureStore.deleteItemAsync('userToken');
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = async (userData) => {
    try {
      setUser(userData);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
      console.error('Update user error:', error);
    }
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
