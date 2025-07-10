import express from 'express';
import {
  signup,
  login,
  sendOTP,
  verifyOTP,
  verifySignupOTP,
  requestPasswordResetOTP,
  resetPasswordWithOTP,
  updatePassword,
  protect,
  restrictTo
} from '../controllers/authController.js';

import {
  getAllUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  updateMe,
  deleteMe,
  addAddressToUser
} from '../controllers/userController.js';

import upload from '../utils/upload.js';

const router = express.Router();

// =======================
// 🔓 Public Authentication Routes
// =======================

// User signup - triggers OTP to phone
router.post('/signup', signup);

// Login with phone & password
router.post('/login', login);

// Send OTP for verification (e.g., during signup)
router.post('/sendOTP', sendOTP);

// Verify OTP code (generic use)
router.post('/verifyOTP', verifyOTP);

// Finalize signup using OTP and create account
router.post('/verifySignupOTP', verifySignupOTP);

// Request password reset OTP
router.post('/requestResetOTP', requestPasswordResetOTP);

// Reset password using OTP
router.post('/resetPasswordOTP', resetPasswordWithOTP);

// =======================
// 🔐 Protected Routes (Require Authentication)
// =======================
router.use(protect);

// Update current user's password
router.patch('/updateMyPassword', updatePassword);

// Update current user's profile info (with optional profile picture)
router.patch('/updateMe', upload.single('profilePicture'), updateMe);

// Soft delete (deactivate) current user's account
router.delete('/deleteMe', deleteMe);

// Add a new address to current user
router.post('/addAddress', addAddressToUser);

// =======================
// 🛡️ Admin-Only Routes
// =======================
router.use(restrictTo('Admin'));

// Admin: GET all users / Create user
router
  .route('/')
  .get(getAllUsers)
  .post(createUser);

// Admin: GET / PATCH / DELETE specific user
router
  .route('/:id')
  .get(getUser)
  .patch(updateUser)
  .delete(deleteUser);

export default router;
