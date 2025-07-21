import crypto from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import User from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

// 📞 Normalize Ethiopian phone number
export const normalizePhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 9) return `+251${digits}`;
  if (digits.length === 12 && digits.startsWith('251')) return `+${digits}`;
  throw new Error('Invalid phone number format');
};

// 🔐 JWT helpers
const signToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 86400000),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);
  user.password = undefined;
  user.passwordConfirm = undefined;
  
  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};

// 📤 1. Send OTP
export const sendOTP = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone || !/^9\d{8}$/.test(phone)) {
    return next(new AppError('Phone must be 9 digits starting with 9', 400));
  }

  const fullPhone = `+251${phone}`;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verifications.create({ to: fullPhone, channel: 'sms' });

  res.status(200).json({ status: 'success', message: `OTP sent to ${fullPhone}` });
});

// ✅ 2. Verify OTP
export const verifyOTP = catchAsync(async (req, res, next) => {
  const { phone, code } = req.body;
  if (!phone || !code) return next(new AppError('Phone and OTP code required', 400));

  const normalizedPhone = normalizePhone(phone);
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const result = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verificationChecks.create({ to: normalizedPhone, code });

  if (result.status !== 'approved') return next(new AppError('Invalid or expired OTP', 400));

  const user = await User.findOne({ phone: normalizedPhone });
  if (!user) return next(new AppError('User not found', 404));

  if (!user.isPhoneVerified) {
    user.isPhoneVerified = true;
    await user.save({ validateBeforeSave: false });
  }

  res.status(200).json({ status: 'success', message: 'Phone verified!' });
});

// 📝 3. Signup (Send OTP)
export const signup = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new AppError('Phone is required', 400));

  const normalizedPhone = normalizePhone(phone);
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verifications.create({ to: normalizedPhone, channel: 'sms' });

  res.status(200).json({
    status: 'success',
    message: `OTP sent to ${normalizedPhone}`,
  });
});

// ✅ 4. Verify Signup & Create User
export const verifySignupOTP = catchAsync(async (req, res, next) => {
  const { phone, code } = req.body;

  // Validate input
  if (!phone || !code) {
    return next(new AppError('Phone and OTP code required', 400));
  }

  // Normalize phone number (e.g., to +251...)
  let normalizedPhone;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (err) {
    return next(new AppError('Invalid phone number format', 400));
  }

  // Init Twilio
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  let check;
  try {
    check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_ID)
      .verificationChecks.create({ to: normalizedPhone, code });
  } catch (err) {
    console.error('Twilio Verify Error:', err);
    return next(new AppError('Failed to verify OTP. Check credentials or service ID.', 500));
  }

  // Check if OTP is correct
  if (check.status !== 'approved') {
    return next(new AppError('OTP invalid or expired', 400));
  }

  // Find user by phone
  let user = await User.findOne({ phone: normalizedPhone });

  const defaultProfilePicture =
    'https://res.cloudinary.com/drinuph9d/image/upload/v1752830842/800px-User_icon_2.svg_vi5e9d.png';

  if (user) {
    user.active = true;
    user.isPhoneVerified = true;

    // Set default profile picture only if not already set
    if (!user.profilePicture) {
      user.profilePicture = defaultProfilePicture;
    }

    await user.save({ validateBeforeSave: false });
    return createSendToken(user, 200, res);
  }

  // No user exists → create one with default role and profile picture
  user = await User.create({
    phone: normalizedPhone,
    password: normalizedPhone,
    passwordConfirm: normalizedPhone,
    isPhoneVerified: true,
    role: 'Customer',
    profilePicture: defaultProfilePicture
  });

  createSendToken(user, 201, res);
});


// 🔑 5. Login
export const login = catchAsync(async (req, res, next) => {
  let { phone, password } = req.body;
  if (!phone || !password)
    return next(new AppError('Phone and password required', 400));

  phone = normalizePhone(phone);

  const user = await User.findOne({ phone }).select('+password');

  if (!user)
    return next(new AppError('No user found with that phone number', 404));

  const isCorrect = await user.correctPassword(password, user.password);
  if (!isCorrect)
    return next(new AppError('Invalid credentials', 401));

  // Step 1: If the phone is not verified, send OTP
  if (!user.isPhoneVerified) {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_ID)
      .verifications.create({ to: phone, channel: 'sms' });

    return res.status(200).json({
      status: 'pending',
      message: 'Phone not verified. OTP sent to your phone.',
      phone: user.phone
    });
  }

  

  // Step 3: Phone is verified and password is not default → normal login
  createSendToken(user, 200, res);
});



// 🛡️ 6. Protect Route Middleware
export const protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
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

// 👮 7. Restrict To Roles Middleware
export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Permission denied', 403));
  }
  next();
};

// 🔁 8. Request Password Reset OTP
export const requestPasswordResetOTP = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new AppError('Phone required', 400));

  const normalizedPhone = normalizePhone(phone);
  const user = await User.findOne({ phone: normalizedPhone });
  if (!user) return next(new AppError('User not found', 404));

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verifications.create({ to: normalizedPhone, channel: 'sms' });

  res.status(200).json({
    status: 'success',
    message: `OTP sent to ${normalizedPhone}`,
  });
});

// 🔁 9. Reset Password With OTP
export const resetPasswordWithOTP = catchAsync(async (req, res, next) => {
  const { phone, code, password, passwordConfirm } = req.body;

  const normalizedPhone = normalizePhone(phone);
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const check = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verificationChecks.create({ to: normalizedPhone, code });

  if (check.status !== 'approved') return next(new AppError('OTP invalid or expired', 400));

  const user = await User.findOne({ phone: normalizedPhone }).select('+password');
  if (!user) return next(new AppError('User not found', 404));
  if (password !== passwordConfirm) return next(new AppError('Passwords do not match', 400));

  user.password = password;
  user.passwordConfirm = passwordConfirm;
  await user.save();

  createSendToken(user, 200, res);
});

// 🔁 10. Authenticated User Password Update
export const updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');


  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  createSendToken(user, 200, res);
});
