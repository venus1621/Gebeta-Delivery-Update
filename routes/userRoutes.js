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
  addAddressToUser,
  getMyAddresses,
  updateUserLocation,
  getUserLocation
} from '../controllers/userController.js';

import upload from '../utils/upload.js';

const router = express.Router();

// =======================
// 🔓 Public Authentication Routes
// =======================

// Signup with OTP
router.post('/signup', signup);

// Login with phone & password
router.post('/login', login);

// Send OTP (generic use)
router.post('/sendOTP', sendOTP);

// Verify OTP code
router.post('/verifyOTP', verifyOTP);

// Complete signup with OTP
router.post('/verifySignupOTP', verifySignupOTP);

// Request password reset via OTP
router.post('/requestResetOTP', requestPasswordResetOTP);

// Reset password using OTP
router.post('/resetPasswordOTP', resetPasswordWithOTP);

// =======================
// 🔐 Protected Routes (Require Authentication)
// =======================

// Apply protect middleware to all routes below
router.use(protect);

router.patch('/:id/updateLocation', updateUserLocation);
router.get('/:id/location',  getUserLocation);
// Update current user's password
router.patch('/updateMyPassword', updatePassword);

// Update current user's profile info
router.patch('/updateMe', upload.single('profilePicture'), updateMe);

// Soft delete current user's account
router.delete('/deleteMe', deleteMe);

// Add an address to current user
router.post('/addAddress', addAddressToUser);


router.get('/myAddresses', getMyAddresses); 

// =======================
// 🛡️ Admin-Only Routes
// =======================

router.use(restrictTo('Admin'));

// Admin: Get all users / create new user
router
  .route('/')
  .get(getAllUsers)
  .post(createUser);

// Admin: Get / update / delete specific user by ID
router
  .route('/:id')
  .get(getUser)
  .patch(updateUser)
  .delete(deleteUser);

export default router;
