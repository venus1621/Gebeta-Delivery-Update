import express from 'express';
import {
  signup,
  login,
  getMe,
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
  activateUser,
  updateMe,
 
  getMyAddresses,
  editAddress,
  deleteAddress,

  saveCurrentAddress
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

router.post('/getMe', protect, getMe);
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



router.use(protect);

// Update current user's password
router.patch('/updateMyPassword', updatePassword);

// Update current user's profile info
router.patch('/updateMe', upload.single('profilePicture'), updateMe);



// Soft delete current user's account


// =======================
// 🏠 Address Routes
// =======================

// Add an address


// Add current geolocation as address
router.post('/saveLocation', saveCurrentAddress);

// Get all addresses of current user
router.get('/myAddresses', getMyAddresses);

// Edit an address
router.patch('/address/:addressId', editAddress);

// Delete an address
router.delete('/address/:addressId', deleteAddress);


// =======================
// 🛡️ Admin-Only Routes
// =======================

router.use(restrictTo('Admin'));

// Admin: Get all users / create new user
router
  .route('/')
  .get(getAllUsers).post( upload.single('profilePicture'), createUser);
router.get('/getUser', getUser);
// Admin: Get / update / delete specific user by ID
router
  .route('/:id')
  .get(getUser)
  .patch( upload.single('profilePicture'),updateUser)
  .delete(deleteUser)
  .put(activateUser);

export default router;
