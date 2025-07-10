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
router.post('/signup', signup);
router.post('/login', login);

// ✅ Twilio OTP Flow
router.post('/sendOTP', sendOTP); // Send OTP for phone verification
router.post('/verifyOTP', verifyOTP); // Verify the OTP after receiving it
router.post('/verifySignupOTP', verifySignupOTP); // Verify OTP during signup
router.post('/requestResetOTP', requestPasswordResetOTP); // Send OTP for password reset
router.post('/resetPasswordOTP', resetPasswordWithOTP); // Reset password via OTP

// =======================
// 🔐 Protected Routes (Require Login)
// =======================
router.use(protect);

router.patch('/updateMyPassword', updatePassword);
router.patch('/updateMe', upload.single('profilePicture'), updateMe);
router.delete('/deleteMe', deleteMe);
router.post('/addAddress', addAddressToUser); // Add address to user profile

// =======================
// 🛡️ Admin-Only Routes
// =======================
router.use(restrictTo('Admin'));

router
  .route('/')
  .get(getAllUsers)       // GET all users (Admin)
  .post(createUser);      // Create new user (Admin)

router
  .route('/:id')
  .get(getUser)           // GET user by ID (Admin)
  .patch(updateUser)      // Update user (Admin)
  .delete(deleteUser);    // Delete user (Admin)

export default router;
