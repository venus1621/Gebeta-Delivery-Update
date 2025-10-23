import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import AppError from './utils/appError.js';
import globalErrorHandler from './controllers/errorController.js';

// Routes
import foodRoutes from './routes/foodRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import foodMenuRoutes from './routes/foodMenuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import deliverRoutes from './routes/deliverRoutes.js';
import userRoutes from './routes/userRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';

const app = express();

// 1️⃣ Trust proxy (important if behind Nginx or Cloudflare)
// app.set('trust proxy',false);

// 2️⃣ Set security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // disable if using external APIs/scripts
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 3️⃣ Enable CORS (configure properly for production)
// const corsOptions = {
//   origin: [
//     'http://localhost:3001',
//     'https://yourproductiondomain.com'
//   ],
//   credentials: true,
// };
app.use(cors());

// 4️⃣ Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 5️⃣ Rate limiting — prevent brute-force or DoS attacks
const limiter = rateLimit({
  max: 100, // limit each IP to 100 requests/hour
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again later!',
});
app.use('/api', limiter);

// 6️⃣ Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// 7️⃣ Data sanitization
// app.use(mongoSanitize()); // prevent NoSQL injection
// app.use(xss());           // prevent XSS attacks

// 8️⃣ Prevent parameter pollution
// app.use(hpp({
//   whitelist: ['price', 'category', 'rating', 'sort'], // allow duplicates for these if needed
// }));

// 9️⃣ Compression
app.use(compression());

// 🔟 Disable x-powered-by
app.disable('x-powered-by');

// 🕒 Add request timestamp middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 🚀 ROUTES
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/foods', foodRoutes);
app.use('/api/v1/food-categories', categoryRoutes);
app.use('/api/v1/restaurants', restaurantRoutes);
app.use('/api/v1/food-menus', foodMenuRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/deliveries', deliverRoutes);
app.use('/api/v1/reviews', ratingRoutes);

// 🌍 Root route
app.get('/', (req, res) => {
  res.status(200).json({ message: '✅ API is working securely 🚀' });
});

// ⚠️ Handle undefined routes
app.use((req, res, next) => { next(new AppError("Can't find ${req.originalUrl} on this server!", 404)); });

// // 🧨 Global error handler
// app.use(globalErrorHandler);

export default app;
