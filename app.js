import express from 'express';
import morgan from 'morgan';
import session from 'express-session';
import transactionRoutes from './routes/transactionRoutes.js';

import foodRoutes from "./routes/foodRoutes.js";
import categoryRoutes from './routes/categoryRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import foodMenuRoutes from './routes/foodMenuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import deliverRoutes from './routes/deliverRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reviewRouter from './routes/reviewRoutes.js';
import globalErrorHandler from './controllers/errorController.js';
import cors from 'cors';

const app = express();
// app.use(cors({
//   origin: 'http://localhost:3001', // update to your frontend domain in production
//   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//   credentials: true
// }));
app.use(cors());

// Middleware
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key', // Replace with a strong secret in production
  resave: false,                // Don't save session if unmodified
  saveUninitialized: false,     // Don't create session until something stored
  cookie: {
    maxAge: 10 * 60 * 1000,     // Session expires after 10 minutes (in milliseconds)
    httpOnly: true,             // Cookie is not accessible via client-side JS
    // secure: true             // Uncomment if using HTTPS (recommended in production)
  }
}));
app.use(morgan('dev'));
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/foods', foodRoutes);
app.use('/api/v1/food-categories', categoryRoutes);
app.use('/api/v1/restaurants', restaurantRoutes);
app.use('/api/v1/food-menus', foodMenuRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/deliveries', deliverRoutes);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/restaurants/:restaurantId/reviews', reviewRouter);
// Example route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'API is working 🚀' });
});
console.log('Verify SID:', process.env.TWILIO_VERIFY_SERVICE_ID);

app.use(globalErrorHandler);
export default app;
