import { parsePhoneNumber } from 'libphonenumber-js';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { body, validationResult } from 'express-validator';
import User from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import Restaurant from '../models/restaurantModel.js';

// 📞 Normalize Ethiopian phone number using libphonenumber-js
export const normalizePhone = (phone) => {
  try {
    const phoneNumber = parsePhoneNumber(phone, 'ET'); // 'ET' for Ethiopia
    if (!phoneNumber.isValid()) {
      throw new AppError('Invalid phone number format', 400);
    }
    return phoneNumber.formatInternational(); // Returns e.g., "+251 91 234 5678"
  } catch (err) {
    throw new AppError('Invalid phone number format', 400);
  }
};

// 🔐 JWT helpers
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;
  user.passwordConfirm = undefined;

  res.status(statusCode).json({
    status: 'success',
    message: 'Logged in successfully',
    token:token,
    data: { user },
  });
};

// 🛠️ Reusable OTP sender
const sendTwilioOTP = catchAsync(async (phone, channel = 'sms') => {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verifications.create({ to: phone, channel });
  return { status: 'success', message: `OTP sent to ${phone}` };
});

// 📤 1. Send OTP
export const sendOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const response = await sendTwilioOTP(normalizedPhone);
    res.status(200).json(response);
  }),
];

// ✅ 2. Verify OTP
export const verifyOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('code').notEmpty().withMessage('OTP code is required'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone, code } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const result = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_ID)
      .verificationChecks.create({ to: normalizedPhone, code });

    if (result.status !== 'approved') return next(new AppError('Invalid or expired OTP', 400));

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) return next(new AppError('User not found', 404));

    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save({ validateBeforeSave: false });
    }

    res.status(200).json({ status: 'success', message: 'Phone verified!' });
  }),
];

// 📝 3. Signup
export const signup = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const response = await sendTwilioOTP(normalizedPhone);
    res.status(200).json({ ...response, status: 'pending', phone: normalizedPhone });
  }),
];

// ✅ 4. Verify Signup & Create User
export const verifySignupOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('code').notEmpty().withMessage('OTP code is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 4 })
    .withMessage('Password must be at least 4 characters'),
  body('passwordConfirm').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));
    const { phone, code, password, passwordConfirm } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_ID)
      .verificationChecks.create({ to: normalizedPhone, code });

    if (check.status !== 'approved') return next(new AppError('OTP invalid or expired', 400));

    let user = await User.findOne({ phone: normalizedPhone });
    const defaultProfilePicture =
      'https://res.cloudinary.com/drinuph9d/image/upload/v1752830842/800px-User_icon_2.svg_vi5e9d.png';

    if (user) {
      user.active = true;
      user.isPhoneVerified = true;
      if (!user.profilePicture) user.profilePicture = defaultProfilePicture;
      await user.save({ validateBeforeSave: false });
      return createSendToken(user, 200, res);
    }

    user = await User.create({
      phone: normalizedPhone,
      password,
      passwordConfirm,
      isPhoneVerified: true,
      role: 'Customer',
      profilePicture: defaultProfilePicture,
    });

    createSendToken(user, 201, res);
  }),
];

// 🔑 5. Login
export const login = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone, password } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const user = await User.findOne({ phone: normalizedPhone }).select('+password');

    if (!user) return next(new AppError('No user found with that phone number', 404));

    const isCorrect = await user.correctPassword(password, user.password);
    if (!isCorrect) return next(new AppError('Invalid credentials', 401));

    if (!user.isPhoneVerified) {
      const response = await sendTwilioOTP(normalizedPhone);
      return res.status(200).json({
        status: 'pending',
        message: 'Phone not verified. OTP sent to your phone.',
        phone: normalizedPhone,
      });
    }

    createSendToken(user, 200, res);
  }),
];

// 🚪 6. Logout
export const logout = catchAsync(async (req, res, next) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 1000), // Expire immediately
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

// 👤 7. Get Me
export const getMe = catchAsync(async (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) return next(new AppError('You are not logged in', 401));

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) return next(new AppError('User not found', 404));

  let restaurant = null;
  if (user.role === 'Manager') {
    restaurant = await Restaurant.findOne({ managerId: user._id });
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
      restaurant: restaurant ? { id: restaurant._id, name: restaurant.name } : null,
    },
  });
});

// 🛡️ 8. Protect Route Middleware
export const protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt; // Fallback to cookie
  }
  if (!token) return next(new AppError('Not logged in', 401));

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) return next(new AppError('User no longer exists', 401));
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password changed recently. Please log in again.', 401));
  }
  req.user = user;
  next();
});

// 👮 9. Restrict To Roles Middleware
export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Permission denied', 403));
  }
  next();
};

// 🔁 10. Request Password Reset OTP
export const requestPasswordResetOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) return next(new AppError('User not found', 404));

    const response = await sendTwilioOTP(normalizedPhone);
    res.status(200).json(response);
  }),
];

// 🔁 11. Reset Password With OTP
export const resetPasswordWithOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('code').notEmpty().withMessage('OTP code is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase, one uppercase, and one number'),
  body('passwordConfirm').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone, code, password, passwordConfirm } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_ID)
      .verificationChecks.create({ to: normalizedPhone, code });

    if (check.status !== 'approved') return next(new AppError('OTP invalid or expired', 400));

    const user = await User.findOne({ phone: normalizedPhone }).select('+password');
    if (!user) return next(new AppError('User not found', 404));

    user.password = password;
    user.passwordConfirm = passwordConfirm;
    await user.save();

    createSendToken(user, 200, res);
  }),
];

// 🔁 12. Authenticated User Password Update
export const updatePassword = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 4 })
    .withMessage('Password must be at least 4 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase, one uppercase, and one number'),
  body('passwordConfirm').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return next(new AppError('User not found', 404));

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    createSendToken(user, 200, res);
  }),
];