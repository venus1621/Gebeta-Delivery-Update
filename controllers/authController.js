import { parsePhoneNumber } from 'libphonenumber-js';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { body, validationResult } from 'express-validator';
import User from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import Restaurant from '../models/restaurantModel.js';

// =======================
// AfroMessage OTP Service
// =======================
class AfroMessageOTP {
  constructor() {
    this.apiToken = process.env.AFROMESSAGE_API_TOKEN;
    this.senderName = process.env.AFROMESSAGE_SENDER_NAME;
    this.identifierId = process.env.AFROMESSAGE_IDENTIFIER_ID;
    this.baseUrl = 'https://api.afromessage.com/api';
    
    if (!this.apiToken) {
      throw new Error('AFROMESSAGE_API_TOKEN is required');
    }
  }

  /**
   * Send OTP code to a phone number
   */
  async sendOTP(phone, options = {}) {
    const {
      codeLength = 6,
      codeType = 0, // 0=numeric, 1=alphabetic, 2=alphanumeric
      ttlSeconds = 300, // 5 minutes
      messagePrefix = 'Your verification code is',
      messagePostfix = '. Do not share this code.',
      spacesBeforeCode = 1,
      spacesAfterCode = 0
    } = options;

    try {
      const params = new URLSearchParams({
        to: phone,
        len: codeLength,
        t: codeType,
        ttl: ttlSeconds,
        pr: messagePrefix,
        ps: messagePostfix,
        sb: spacesBeforeCode,
        sa: spacesAfterCode
      });

      if (this.identifierId) params.append('from', this.identifierId);
      if (this.senderName) params.append('sender', this.senderName);

      const response = await axios.get(`${this.baseUrl}/challenge`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        params,
        timeout: 30000
      });

      if (response.data.acknowledge === 'success') {
        return {
          success: true,
          verificationId: response.data.response.verificationId,
          messageId: response.data.response.message_id,
          code: response.data.response.code, // For logging/debugging only
          message: response.data.response.message,
          to: response.data.response.to
        };
      }

      return {
        success: false,
        error: response.data.response || 'Failed to send OTP'
      };
    } catch (error) {
      console.error('AfroMessage sendOTP error:', error.response?.data || error.message);
      throw new AppError('Failed to send OTP. Please try again.', 500);
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(code, phone = null, verificationId = null) {
    if (!phone && !verificationId) {
      throw new AppError('Either phone or verificationId is required', 400);
    }

    try {
      const params = new URLSearchParams({ code });
      if (verificationId) params.append('vc', verificationId);
      if (phone) params.append('to', phone);

      const response = await axios.get(`${this.baseUrl}/verify`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        params,
        timeout: 30000
      });

      if (response.data.acknowledge === 'success') {
        return {
          success: true,
          verified: true,
          phone: response.data.response.phone,
          verificationId: response.data.response.verificationId
        };
      }

      return {
        success: false,
        verified: false,
        error: response.data.response || 'Verification failed'
      };
    } catch (error) {
      console.error('AfroMessage verifyOTP error:', error.response?.data || error.message);
      // If verification fails, it's likely invalid/expired code
      return {
        success: false,
        verified: false,
        error: 'Invalid or expired OTP code'
      };
    }
  }
}

// Initialize AfroMessage service
const afroMessageService = new AfroMessageOTP();

// =======================
// Helper Functions
// =======================

// 📞 Normalize Ethiopian phone number
export const normalizePhone = (phone) => {
  try {
    const phoneNumber = parsePhoneNumber(phone, 'ET');
    if (!phoneNumber.isValid()) {
      throw new AppError('Invalid phone number format', 400);
    }
    return phoneNumber.format('E.164'); // Returns e.g., "+251912345678"
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
    token: token,
    data: { user },
  });
};

// 🛠️ Reusable OTP sender
const sendAfroMessageOTP = async (phone) => {
  const result = await afroMessageService.sendOTP(phone, {
    codeLength: 6,
    codeType: 0,
    ttlSeconds: 300,
    messagePrefix: 'Your verification code is',
    messagePostfix: '. Valid for 5 minutes.',
    spacesBeforeCode: 1
  });

  if (!result.success) {
    throw new AppError(result.error || 'Failed to send OTP', 500);
  }

  return {
    status: 'success',
    data: {
      message: `OTP sent to ${phone}`,
      verificationId: result.verificationId
    }
  };
};

// =======================
// Auth Controllers
// =======================

// 📤 1. Send OTP
export const sendOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const response = await sendAfroMessageOTP(normalizedPhone);
    
    res.status(200).json({
      ...response,
      phone: normalizedPhone
    });
  }),
];

// ✅ 2. Verify OTP
export const verifyOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('code').notEmpty().withMessage('OTP code is required'),
  body('verificationId').optional(),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone, code, verificationId } = req.body;
    const normalizedPhone = normalizePhone(phone);

    const result = await afroMessageService.verifyOTP(
      code,
      normalizedPhone,
      verificationId
    );

    if (!result.success || !result.verified) {
      return next(new AppError(result.error || 'Invalid or expired OTP', 400));
    }

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) return next(new AppError('User not found', 404));

    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save({ validateBeforeSave: false });
    }

    res.status(200).json({ 
      status: 'success', 
      message: 'Phone verified!' 
    });
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
    
    // Check if user already exists
    const existingUser = await User.findOne({ phone: normalizedPhone });
    if (existingUser && existingUser.isPhoneVerified) {
      return next(new AppError('User already exists. Please login.', 400));
    }

    const response = await sendAfroMessageOTP(normalizedPhone);
    console.log('OTP sent response:', response);
    res.status(200).json({ 
      status: 'pending', 
      message: response.data.message,
      phone: normalizedPhone,
      verificationId: response.data.verificationId
    });
  }),
];

// ✅ 4. Verify Signup & Create User (OTP as initial password)
export const verifySignupOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('code').notEmpty().withMessage('OTP code is required'),
  body('verificationId').optional(),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone, code, verificationId } = req.body;
    const normalizedPhone = normalizePhone(phone);

    const result = await afroMessageService.verifyOTP(
      code,
      normalizedPhone,
      verificationId
    );

    if (!result.success || !result.verified) {
      return next(new AppError(result.error || 'OTP invalid or expired', 400));
    }

    
    // New user - use OTP code as initial password
    const user = await User.create({
      phone: normalizedPhone,
      password: code,          // Use OTP as initial password
      passwordConfirm: code,   // Confirm with same OTP
      isPhoneVerified: true,
      role: 'Customer',
      requirePasswordChange: true  // Flag to force password change
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
      const response = await sendAfroMessageOTP(normalizedPhone);
      return res.status(200).json({
        status: 'pending',
        message: 'Phone not verified. OTP sent to your phone.',
        phone: normalizedPhone,
        verificationId: response.verificationId
      });
    }

    createSendToken(user, 200, res);
  }),
];

// 🚪 6. Logout
export const logout = catchAsync(async (req, res, next) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 1000),
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
    token = req.cookies.jwt;
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

    const response = await sendAfroMessageOTP(normalizedPhone);
    
    res.status(200).json({
      ...response,
      phone: normalizedPhone
    });
  }),
];

// 🔁 11. Reset Password With OTP
export const resetPasswordWithOTP = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('code').notEmpty().withMessage('OTP code is required'),
  body('verificationId').optional(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 4 })
    ,  body('passwordConfirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new AppError(errors.array()[0].msg, 400));

    const { phone, code, verificationId, password, passwordConfirm } = req.body;
    const normalizedPhone = normalizePhone(phone);

    const result = await afroMessageService.verifyOTP(
      code,
      normalizedPhone,
      verificationId
    );

    if (!result.success || !result.verified) {
      return next(new AppError(result.error || 'OTP invalid or expired', 400));
    }

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
    ,  body('passwordConfirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
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