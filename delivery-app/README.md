# Gebeta Delivery Mobile App

A React Native mobile application for delivery personnel to manage and complete food delivery orders in real-time.

## Features

### 🚀 Core Functionality
- **Real-time Order Notifications**: Receive instant notifications when orders are ready for pickup
- **Socket Programming**: Live connection to backend server for real-time updates
- **Order Management**: View, accept, and track delivery orders
- **Verification System**: Two-step verification process (pickup and delivery)
- **Location Services**: Integration with maps for navigation

### 📱 User Interface
- **Modern Design**: Clean, intuitive Material Design interface
- **Responsive Layout**: Optimized for various screen sizes
- **Dark/Light Theme**: Consistent visual experience
- **Accessibility**: Support for different user needs

### 🔐 Authentication & Security
- **Static Token Authentication**: Pre-configured for development
- **Secure Storage**: Encrypted storage for sensitive data
- **Session Management**: Automatic login and logout handling

## Screens

### 1. Login Screen
- Static authentication with demo credentials
- Auto-login functionality
- User-friendly error handling

### 2. Home Screen
- **Available Orders Tab**: View orders ready for pickup
- **Accepted Orders Tab**: Track current deliveries
- **Real-time Updates**: Live order count and status
- **Pull to Refresh**: Manual refresh capability

### 3. Order Details Screen
- Comprehensive order information
- Pickup and delivery locations
- Payment details and totals
- Order acceptance functionality
- Integration with maps apps

### 4. Pickup Verification Screen
- Restaurant pickup verification
- 6-digit verification code input
- Step-by-step instructions
- Success confirmation

### 5. Delivery Verification Screen
- Customer delivery verification
- Final delivery completion
- Professional delivery tips
- Order completion confirmation

### 6. Profile Screen
- User information display
- Contact details with direct actions
- Account statistics
- App information and settings

## Technical Architecture

### Frontend Framework
- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and tools
- **React Navigation**: Screen navigation management
- **React Native Paper**: Material Design components

### State Management
- **Context API**: React's built-in state management
- **Custom Hooks**: Reusable logic and state
- **Local Storage**: Persistent data storage

### Real-time Communication
- **Socket.IO**: WebSocket connection to backend
- **Event-driven Updates**: Real-time order notifications
- **Connection Management**: Automatic reconnection handling

### API Integration
- **RESTful APIs**: Backend server communication
- **Authentication**: Bearer token implementation
- **Error Handling**: Comprehensive error management

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd delivery-app
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Start Development Server
```bash
npm start
# or
yarn start
```

### 4. Run on Device/Simulator
```bash
# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

## Configuration

### Environment Variables
The app uses the following configuration:

```javascript
// Backend API URL
BASE_URL: 'https://gebeta-delivery1.onrender.com/api/v1'

// Socket Server URL
SOCKET_URL: 'https://gebeta-delivery1.onrender.com'

// Static Authentication Token
STATIC_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Demo Credentials
For development purposes, the app includes static credentials:

- **Email**: adminuser@example.com
- **Password**: password123
- **Role**: Delivery_Person

## API Endpoints

### Order Management
- `POST /orders/accept-for-delivery` - Accept an order for delivery
- `POST /orders/verify-delivery` - Verify delivery completion
- `GET /orders/{id}` - Get order details
- `PATCH /orders/update-status` - Update order status

### Authentication
- Bearer token authentication for all API calls
- Automatic token inclusion in request headers

## Socket Events

### Client to Server
- `join-deliveries` - Join delivery personnel room

### Server to Client
- `order:cooked` - New order ready for pickup
- `available-orders-count` - Update available orders count
- `order:status-updated` - Order status change notification

## Development Workflow

### 1. Order Flow
```
Available Order → Accept Order → Pickup Verification → Delivery → Completion
```

### 2. Development Process
1. **Setup**: Install dependencies and configure environment
2. **Development**: Use Expo development server
3. **Testing**: Test on physical devices and simulators
4. **Building**: Create production builds with Expo

### 3. Code Structure
```
src/
├── components/          # Reusable UI components
├── context/            # React Context providers
├── screens/            # Application screens
├── services/           # API and external services
└── utils/              # Utility functions
```

## Testing

### Manual Testing
- Test on different device sizes
- Verify socket connections
- Test order flow end-to-end
- Validate error handling

### Automated Testing
- Unit tests for utility functions
- Component testing with React Native Testing Library
- Integration tests for API calls

## Deployment

### Android
1. Build APK with Expo
2. Test on physical devices
3. Upload to Google Play Store

### iOS
1. Build with Expo
2. Test on iOS devices
3. Submit to App Store

## Troubleshooting

### Common Issues

#### Socket Connection Failed
- Check internet connectivity
- Verify backend server status
- Check authentication token validity

#### Order Not Updating
- Refresh the app
- Check socket connection status
- Verify API endpoints

#### Build Errors
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall
- Update Expo CLI: `npm install -g @expo/cli`

## Contributing

### Development Guidelines
1. Follow React Native best practices
2. Use consistent code formatting
3. Add proper error handling
4. Include comprehensive documentation
5. Test on multiple devices

### Code Style
- Use functional components with hooks
- Implement proper TypeScript types
- Follow Material Design principles
- Maintain consistent naming conventions

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Changelog

### Version 1.0.0
- Initial release
- Real-time order management
- Socket programming integration
- Complete delivery workflow
- Modern UI/UX design

---

**Built with ❤️ for Gebeta Delivery**
