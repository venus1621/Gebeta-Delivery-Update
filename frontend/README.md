# Frontend (Expo React Native) - Delivery App

A modern delivery app that listens for `order:cooked` events from your backend and displays available orders with real-time updates, maps, and notifications.

## ✨ Features

- **Real-time Order Notifications**: Instant alerts when new orders become cooked
- **Multiple Orders Management**: View all available cooked orders in a scrollable list
- **Live Order Count**: Real-time badge showing available orders count
- **Interactive Map**: Full-screen map with restaurant/delivery markers and route
- **Sound Notifications**: Audio alerts for new orders
- **Order Details**: Comprehensive order information including customer details, food items, and locations
- **Accept/Decline Actions**: Bottom sheet with accept/decline buttons for each order
- **Auto-refresh**: Manual refresh button to reload available orders

## 🚀 Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Set the Socket backend URL in `src/config/env.js`:
```javascript
export const SOCKET_URL = 'https://gebeta-delivery1.onrender.com';
```

- Android emulator: `http://10.0.2.2:3000`
- iOS simulator: `http://localhost:3000`
- Real device: `http://YOUR_LAN_IP:3000`

## 🔌 Socket Events

The app listens to these backend events:
- `order:cooked`: New cooked order notification with full order details
- `available-orders-count`: Real-time count of available orders
- `delivery:assigned`: Order assigned to delivery person
- `delivery:cancelled`: Delivery assignment cancelled

## 📱 App Flow

1. **Connection**: App connects to Socket.IO and joins 'deliveries' room
2. **Initial Load**: Fetches all available cooked orders via API
3. **Real-time Updates**: Listens for new cooked orders and count changes
4. **Order Display**: Shows orders in a list with newest at top
5. **Map Integration**: Displays restaurant and delivery locations with route
6. **Actions**: Accept/decline orders with immediate UI updates

## 🗺️ Map Features

- Shows current driver location (requires location permission)
- Displays restaurant (red marker) and delivery (green marker) locations
- Draws route polyline between locations using OSRM
- Auto-fits map to show all relevant markers
- Updates in real-time when new orders arrive

## 📋 Order Information Displayed

- Order ID and customer details
- Food items with quantities and prices
- Delivery fee, tip, and grand total
- Restaurant and delivery coordinates
- Order creation time
- Real-time status updates

## 🔧 API Endpoints Used

- `GET /api/v1/orders/available-cooked`: Fetch all available cooked orders
- `GET /api/v1/orders/available-cooked/count`: Get count of available orders
- `POST /api/v1/deliveries`: Accept an order
- `POST /api/v1/deliveries/cancel`: Decline an order

## 🎨 UI Components

- **MapScreen**: Full-screen map with markers and routes
- **BottomSheetOrder**: Animated bottom sheet for order details and actions
- **CookedOrdersListener**: Socket event handler and notification manager
- **Order Cards**: Rich order information display with customer and food details

## 🚀 Run

```bash
npm run android
# or
npm run web
```

## 📱 Permissions Required

- **Location**: Required for showing driver position and map functionality
- **Internet**: Required for Socket.IO connection and API calls

## 🔄 Real-time Updates

The app automatically:
- Updates order count when orders become available
- Removes orders from list when accepted/declined
- Refreshes map when new orders arrive
- Plays sound notifications for new orders
- Updates UI immediately after actions

## 🎯 Backend Integration

Your backend should emit:
- `order:cooked` with full order payload when status changes to 'Cooked'
- `available-orders-count` with updated count after order changes
- Support the new API endpoints for available orders

The app is designed to work seamlessly with your updated backend that supports multiple cooked orders and real-time notifications.
