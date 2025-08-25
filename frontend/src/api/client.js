import axios from 'axios';
import { SOCKET_URL } from '../config/env';

// Derive API base from SOCKET_URL
const baseURL = SOCKET_URL.replace(/\/$/, '');

export const api = axios.create({ baseURL });

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}


