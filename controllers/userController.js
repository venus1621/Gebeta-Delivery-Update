import User from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import cloudinary from '../utils/cloudinary.js';
import streamifier from 'streamifier';
import multer from 'multer';
// Utility to filter only allowed fields from request body
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// GET /api/v1/users
export const getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();
  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});

// PATCH /api/v1/users/updateMe
export const updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates.', 400));
  }

  // Upload profile image to Cloudinary if provided
  if (req.file) {
    const uploadFromBuffer = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'profile_pictures' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    };

    const result = await uploadFromBuffer(req.file.buffer);
    req.body.profilePicture = result.secure_url;
  }

  const filteredBody = filterObj(
    req.body,
    'firstName',
    'lastName',
    'email',
    'phone',
    'profilePicture'
  );

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: { user: updatedUser }
  });
});



// DELETE /api/v1/users/deleteMe
export const deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// GET /api/v1/users/:id
export const getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

// POST /api/v1/users
export const createUser = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { user: newUser }
  });
});

// PATCH /api/v1/users/:id
export const updateUser = catchAsync(async (req, res, next) => {
  const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!updatedUser) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { user: updatedUser }
  });
});

// DELETE /api/v1/users/:id
export const deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, { active: false });

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

export const addAddressToUser = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const newAddress = req.body;

  // Validate required fields
  const requiredFields = ['name', 'label', 'coordinates'];
  for (let field of requiredFields) {
    if (!newAddress[field] || (field === 'coordinates' && (!newAddress.coordinates.lat || !newAddress.coordinates.lng))) {
      return next(new AppError(`Missing required field: ${field}`, 400));
    }
  }

  const user = await User.findById(userId);
  if (!user) return next(new AppError('User not found', 404));

  // If this address is set as default, unset all others
  if (newAddress.isDefault) {
    user.addresses.forEach(addr => (addr.isDefault = false));
  }

  // Add new address
  user.addresses.push(newAddress);
  await user.save({ validateBeforeSave: false });


  res.status(201).json({
    status: 'success',
    message: 'Address added successfully',
    addresses: user.addresses
  });
});