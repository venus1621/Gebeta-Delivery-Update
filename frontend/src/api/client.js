import axios from 'axios';
import { SOCKET_URL } from '../config/env';

// Derive API base from SOCKET_URL
const baseURL = SOCKET_URL.replace(/\/$/, '');

export const api = axios.create({ baseURL });
const STATIC_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OTFhNWZjNTZlYWE3ODgxMDJmOGM5MyIsImlhdCI6MTc1NjEwNjIzMywiZXhwIjoxNzYzODgyMjMzfQ.YW0ukdUv5DJIs4MT9YMk-8IQPUXUlP_OHa4xutrrjy8";

// Set default Authorization header with static token
api.defaults.headers.common.Authorization = `Bearer ${STATIC_TOKEN}`;

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}


