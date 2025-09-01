import User from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import cloudinary from '../utils/cloudinary.js';
import streamifier from 'streamifier';
import multer from 'multer';
import { normalizePhone } from './authController.js';
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

  // Upload profile image to Cloudinary using user ID as public_id
  if (req.file) {
    const uploadFromBuffer = (fileBuffer, publicId) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'profile_pictures',
            public_id: publicId,
            overwrite: true,
            resource_type: 'image'
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    };

    const publicId = req.user.id.toString(); // ensure string type
    const result = await uploadFromBuffer(req.file.buffer, publicId);
    req.body.profilePicture = result.secure_url;
  }

  const filteredBody = filterObj(
    req.body,
    'firstName',
    'lastName',
    'email',
    'profilePicture',
    'deliveryMethod'
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
  const { phone } = req.body;
  if (!phone) return next(new AppError('Phone number is required', 400));

  const normalizedPhone = normalizePhone(phone);

  const newUser = await User.create({
    ...req.body,
    phone: normalizedPhone,
    password: normalizedPhone,
    passwordConfirm: normalizedPhone,
    isPhoneVerified: false,
    role: req.body.role || 'Customer'
  });

  res.status(201).json({
    status: 'success',
    message: 'User created successfully. User must verify phone and change password after login.',
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

export const getMyAddresses = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const user = await User.findById(userId).select('addresses');
  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({
    status: 'success',
    addresses: user.addresses
  });
});

// PATCH /api/v1/users/:id/updateLocation
export const updateUserLocation = catchAsync(async (req, res, next) => {
  const { lat, lng } = req.body;

  if (!lat || !lng) {
    return next(new AppError('Latitude and longitude are required', 400));
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Optional: You can update the default address, or push a new one.
  
  
    user.location = {
      latitude: lat,
      longitude: lng,
      updatedAt: new Date()
    };

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'User location updated successfully',
    data: {
      id: user._id,
      location:user.location
    }
  });
});

export const getUserLocation = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('location');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      status: 'success',
      location: user,
    });
  } catch (error) {
    console.error('Error fetching user location:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const editAddress = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const addressId = req.params.addressId;

  const user = await User.findById(userId);
  if (!user) return next(new AppError('User not found', 404));

  const address = user.addresses.id(addressId);
  if (!address) return next(new AppError('Address not found', 404));

  // Update fields from body
  const { name, label, additionalInfo, coordinates, isDefault } = req.body;

  if (name) address.name = name;
  if (label) address.label = label;
  if (additionalInfo) address.additionalInfo = additionalInfo;
  if (coordinates) {
    if (coordinates.lat) address.coordinates.lat = coordinates.lat;
    if (coordinates.lng) address.coordinates.lng = coordinates.lng;
  }

  // If this address is set as default, unset all others
  if (isDefault) {
    user.addresses.forEach(addr => (addr.isDefault = false));
    address.isDefault = true;
  } else if (isDefault === false) {
    address.isDefault = false;
  }

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Address updated successfully',
    address
  });
});

// DELETE /api/v1/users/address/:addressId
export const deleteAddress = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const addressId = req.params.addressId;

  const user = await User.findById(userId);
  if (!user) return next(new AppError('User not found', 404));

  // Remove the address using pull
  const address = user.addresses.id(addressId);
  if (!address) return next(new AppError('Address not found', 404));

  // Pull the subdocument from the addresses array
  user.addresses.pull(address._id);

  await user.save({ validateBeforeSave: false });

  res.status(204).json({
    status: 'success',
    message: 'Address deleted successfully'
  });
});


// PATCH /api/v1/users/address/:addressId/setDefault
export const setDefaultAddress = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const addressId = req.params.addressId;

  const user = await User.findById(userId);
  if (!user) return next(new AppError('User not found', 404));

  const address = user.addresses.id(addressId);
  if (!address) return next(new AppError('Address not found', 404));

  // Unset all addresses
  user.addresses.forEach(addr => (addr.isDefault = false));

  // Set this one as default
  address.isDefault = true;

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Default address updated successfully',
    address
  });
});

// POST /api/v1/users/address/current
export const addCurrentLocationAsAddress = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { label = 'Home', additionalInfo = '', isDefault = false } = req.body;

  const { lat, lng } = req.body.coordinates || {};
  if (!lat || !lng) {
    return next(new AppError('Latitude and longitude are required', 400));
  }

  const user = await User.findById(userId);
  if (!user) return next(new AppError('User not found', 404));

  // If this address is set as default, unset all others
  if (isDefault) {
    user.addresses.forEach(addr => (addr.isDefault = false));
  }

  // Save current location as an address
  const newAddress = {
    name: 'Current Location',
    label,
    additionalInfo,
    isDefault,
    coordinates: { lat, lng }
  };

  user.addresses.push(newAddress);
  await user.save({ validateBeforeSave: false });

  res.status(201).json({
    status: 'success',
    message: 'Current location saved as address',
    address: newAddress,
    addresses: user.addresses
  });
});
