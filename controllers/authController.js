import crypto from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

import twilio from 'twilio';
import { normalize } from 'path';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
 // Optional sender name
);

// Helper to normalize Ethiopian phone numbers to +251XXXXXXXXX
const normalizePhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 9) return `+251${digits}`;
  if (digits.length === 12 && digits.startsWith('251')) return `+${digits}`;
  throw new Error('Invalid phone number format');
};

const signToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;
  user.passwordConfirm = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user }
  });
};

// 1. Send OTP to phone
export const sendOTP = catchAsync(async (req, res, next) => {
  let { phone } = req.body;
  console.log(process.env.TWILIO_ACCOUNT_SID);
  console.log(process.env.TWILIO_AUTH_TOKEN);
  if (!phone) return next(new AppError('Phone number required', 400));

  // Validate Ethiopian 9-digit number (starts with 9)
  if (!/^9\d{8}$/.test(phone)) {
    return next(
      new AppError(
        `${phone} is not valid! Phone must be 9 digits starting with 9 (Ethiopian format, no +251)`,
        400
      )
    );
  }



  const fullPhone = `+251${phone}`;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

 await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_ID)
      .verifications
      .create({to: fullPhone, channel: 'sms'})
      .then(verification => console.log(verification.sid));
 
  res.status(200).json({ status: 'success', message: `OTP sent to ${fullPhone}` });
});


// // 2. Verify OTP and mark phone verified
export const verifyOTP = catchAsync(async (req, res, next) => {
  const { phone, code } = req.body;
  if (!phone || !code) return next(new AppError('Phone and OTP code required', 400));

  let normalizedPhone;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (err) {
    return next(new AppError(err.message, 400));
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const verificationCheck = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verificationChecks.create({ to: normalizedPhone, code });

  if (verificationCheck.status !== 'approved') {
    return next(new AppError('Invalid or expired OTP', 400));
  }

  // Find the user with this phone number
  const user = await User.findOne({ phone: normalizedPhone });
  if (!user) return next(new AppError('User not found with this phone number', 404));

  // Update verification status
  if (!user.isPhoneVerified) {
    user.isPhoneVerified = true;
    await user.save({ validateBeforeSave: false });
  }

  res.status(200).json({
    status: 'success',
    message: 'Phone number successfully verified!',
  });
});



// // 3. Signup user (phone must be verified beforehand)
// export const signup = catchAsync(async (req, res, next) => {
//   const { firstName, lastName, phone, email, password, passwordConfirm, role } = req.body;

//   let normalizedPhone;
//   try {
//     normalizedPhone = normalizePhone(phone);
//   } catch (err) {
//     return next(new AppError(err.message, 400));
//   }

//   const existingUser = await User.findOne({ phone: normalizedPhone });
//   if (existingUser) return next(new AppError('Phone already registered', 400));

//   const newUser = await User.create({
//     firstName,
//     lastName,
//     phone: normalizedPhone,
//     email,
//     password,
//     passwordConfirm,
//     role,
//     isPhoneVerified: true, // Assumes phone was verified before signup
//   });

//   createSendToken(newUser, 201, res);
// });

export const verifySignupOTP = catchAsync(async (req, res, next) => {
  const { phone, code } = req.body;

  if (!phone || !code)
    return next(new AppError('Phone and OTP code required', 400));

  let normalizedPhone;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (err) {
    return next(new AppError(err.message, 400));
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const verificationCheck = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verificationChecks.create({ to: normalizedPhone, code });

  if (verificationCheck.status !== 'approved') {
    return next(new AppError('Invalid or expired OTP', 400));
  }

  const existingUser = await User.findOne({ phone: normalizedPhone });

  if (existingUser) {
    if (existingUser.active === false) {
      existingUser.active = true;
      existingUser.isPhoneVerified = true;
      await existingUser.save();
    }
    return createSendToken(existingUser, 200, res);
  }
  // If no user exists, create new one (since session isn't used)
  

  const newUser = await User.create({
    password:normalizedPhone,
    passwordConfirm: normalizedPhone,
    phone: normalizedPhone,
    isPhoneVerified: true,
    role: 'Customer', // Default role
  });

  createSendToken(newUser, 201, res);
});



// signup - store signup data temporarily in session and send OTP
export const signup = catchAsync(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone)
    return next(new AppError('Phone number is required', 400));

  let normalizedPhone;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (err) {
    return next(new AppError(err.message, 400));
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verifications.create({
      to: normalizedPhone,
      channel: 'sms',
    });

  res.status(200).json({
    status: 'success',
    message: `OTP sent to ${normalizedPhone}. Submit full signup data along with code to verify.`,
  });
});




// 4. Login user (phone must be verified)
export const login = catchAsync(async (req, res, next) => {
  let { phone, password } = req.body;
  if (!phone || !password) return next(new AppError('Phone and password required', 400));

  try {
    phone = normalizePhone(phone);
  } catch (err) {
    return next(new AppError(err.message, 400));
  }

  const user = await User.findOne({ phone }).select('+password');
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect phone or password', 401));
  }

  if (!user.isPhoneVerified) {
    return next(new AppError('Phone number is not verified', 403));
  }

  createSendToken(user, 200, res);
});

// 5. Protect middleware (JWT auth)
export const protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next(new AppError('Not logged in', 401));

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) return next(new AppError('User no longer exists', 401));

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password changed recently. Please log in again.', 401));
  }

  req.user = currentUser;
  next();
});

// 6. Restrict to roles middleware
export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Permission denied', 403));
  }
  next();
};

// 7. Request password reset OTP
// export const requestPasswordResetOTP = catchAsync(async (req, res, next) => {
//   let { phone } = req.body;
//   if (!phone) return next(new AppError('Phone number required', 400));

//   try {
//     phone = normalizePhone(phone);
//   } catch (err) {
//     return next(new AppError(err.message, 400));
//   }

//   const user = await User.findOne({ phone });
//   if (!user) return next(new AppError('No user with that phone', 404));

//   await client.verify.v2
//     .services(process.env.TWILIO_VERIFY_SERVICE_ID)
//     .verifications.create({ to: phone, channel: 'sms' });

//   res.status(200).json({ status: 'success', message: 'Password reset OTP sent' });
// });


export const requestPasswordResetOTP = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new AppError('Phone number required', 400));

  let normalizedPhone;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (err) {
    return next(new AppError(err.message, 400));
  }

  const user = await User.findOne({ phone: normalizedPhone });
  if (!user) return next(new AppError('No user with that phone', 404));

  // Initialize Twilio client (just like in signup)
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verifications.create({
      body: `Hello from Gebeta! Your password reset code is: 123456`,
      from: 'Gebeta Delivery',// Optional sender name
      to: normalizedPhone,
      channel: 'sms',
    });

  res.status(200).json({
    status: 'success',
    message: `OTP sent to ${normalizedPhone} for password reset.`,
  });
});

// 8. Reset password via OTP
export const resetPasswordWithOTP =  catchAsync(async (req, res, next) => {
  const { phone, code, password, passwordConfirm } = req.body;

  if (!phone || !code || !password || !passwordConfirm) {
    return next(new AppError('Phone, OTP code, and new passwords are required', 400));
  }

  let normalizedPhone;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (err) {
    return next(new AppError(err.message, 400));
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const verificationCheck = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_ID)
    .verificationChecks.create({ to: normalizedPhone, code });

  if (verificationCheck.status !== 'approved') {
    return next(new AppError('Invalid or expired OTP', 400));
  }

  const user = await User.findOne({ phone: normalizedPhone }).select('+password');
  if (!user) return next(new AppError('No user with that phone number', 404));

  if (password !== passwordConfirm) {
    return next(new AppError('Passwords do not match', 400));
  }

  user.password = password;
  user.passwordConfirm = passwordConfirm;
  await user.save();

  createSendToken(user, 200, res);
});


// 9. Update password (authenticated user)
export const updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Current password is incorrect', 401));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  createSendToken(user, 200, res);
});
