import Restaurant from '../models/restaurantModel.js';
import Rating from '../models/Rating.js'; // Import Rating to ensure model registration
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import User from '../models/userModel.js';
import NodeGeocoder from 'node-geocoder';
import cloudinary from '../utils/cloudinary.js';
import streamifier from 'streamifier';
import filterObj from '../utils/filterObj.js';
import mongoose from 'mongoose';
import { getDistance } from 'geolib';

// Alias for top 5 rated restaurants
export const aliasTopRestaurants = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingAverage';
  req.query.fields = 'name,location,ratingAverage,cuisineTypes,isDeliveryAvailable';
  next();
};

const geocoder = NodeGeocoder({
  provider: 'openstreetmap'
});

export const getRestaurantsWithDistanceFromCoords = catchAsync(async (req, res, next) => {
  const { lng, lat, radius } = req.query;

  // Validate input
  if (!lng || !lat || !radius) {
    return next(new AppError('Please provide longitude (lng), latitude (lat), and radius (in kilometers) in query.', 400));
  }

  const userCoords = [parseFloat(lng), parseFloat(lat)];
  const radiusInMeters = parseFloat(radius) * 1000; // Convert kilometers to meters for MongoDB

  // Find restaurants within the specified radius using MongoDB geospatial query
  const restaurants = await Restaurant.find({
    active: true,
    location: {
      $geoWithin: {
        $centerSphere: [userCoords, radiusInMeters / 6378137] // Earth's radius in meters
      }
    }
  });

  // Map over restaurants and calculate distance using geolib
  const results = restaurants.map((restaurant) => {
    const restCoords = restaurant.location.coordinates; // [lng, lat]

    // Calculate distance using geolib
    const distance = getDistance(
      { latitude: lat, longitude: lng },
      { latitude: restCoords[1], longitude: restCoords[0] }
    ); // Returns distance in meters

    return {
      ...restaurant.toObject(),
      distanceMeters: Math.round(distance),
      durationMinutes: null // Duration not calculated without OSRM
    };
  });

  // Sort by nearest distance first
  const sorted = results.sort((a, b) => a.distanceMeters - b.distanceMeters);

  res.status(200).json({
    status: 'success',
    results: sorted.length,
    data: sorted
  });
});


// Get all restaurants with filtering, sorting, pagination & search
export const getAllRestaurants = catchAsync(async (req, res, next) => {
  // Build the query
  const query = Restaurant.find().populate({
    path: 'managerId',
    select: 'firstName lastName phone',
  });

  // Execute the query
  const restaurants = await query;

  // If no restaurants found
  if (!restaurants || restaurants.length === 0) {
    return next(new AppError('No restaurants found', 404));
  }

  // Format response for frontend
  const formattedRestaurants = restaurants.map((restaurant) => ({
    id: restaurant._id,
    name: restaurant.name,
    location: {
      address: restaurant.location?.address || '',
      coordinates: restaurant.location?.coordinates || [],
    },
    cuisineTypes: restaurant.cuisineTypes,
    imageCover: restaurant.imageCover,
    description: restaurant.description,
    shortDescription: restaurant.shortDescription,
    ratingAverage: restaurant.ratingAverage,
    ratingQuantity: restaurant.ratingQuantity,
    isDeliveryAvailable: restaurant.isDeliveryAvailable,
    isOpenNow: restaurant.isOpenNow,
    manager: restaurant.managerId
      ? {
          id: restaurant.managerId._id,
          name: `${restaurant.managerId.firstName} ${restaurant.managerId.lastName}`,
          phone: restaurant.managerId.phone,
        }
      : null,
    ratings: restaurant.rating,
  }));

  // Send response
  res.status(200).json({
    status: 'success',
    results: formattedRestaurants.length,
    data: formattedRestaurants,
  });
});

// Get one restaurant by ID
export const getRestaurant = catchAsync(async (req, res, next) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return next(new AppError('No restaurant found with that ID', 404));
  }

  // Get all food menus for this restaurant
  const foodMenus = await mongoose.model('FoodMenu').find({
    restaurantId: restaurant._id,
    active: true
  });

  // Get all foods from these menus
  const menuIds = foodMenus.map(menu => menu._id);
  const foods = await mongoose.model('Food').find({
    menuId: { $in: menuIds },
    status: 'Available'
  });

  // Return foods without grouping by category
  const foodList = foods.map(food => ({
    _id: food._id,
    foodName: food.foodName,
    price: food.price,
    ingredients: food.ingredients,
    instructions: food.instructions,
    cookingTimeMinutes: food.cookingTimeMinutes,
    rating: food.rating,
    imageCover: food.imageCover,
    isFeatured: food.isFeatured,
    status: food.status,
    menuId: food.menuId
  })).sort((a, b) => a.foodName.localeCompare(b.foodName));

  res.status(200).json({
    status: 'success',
    data: {
      restaurant,
      foods: foodList,
      totalFoods: foodList.length
    }
  });
});

// Alternative: Get restaurant with foods using aggregation pipeline (more efficient)
export const getRestaurantWithMenu = catchAsync(async (req, res, next) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return next(new AppError('No restaurant found with that ID', 404));
  }

  // Use aggregation pipeline for better performance
  const result = await mongoose.model('Food').aggregate([
    // Match foods from this restaurant's menus
    {
      $lookup: {
        from: 'foodmenus',
        localField: 'menuId',
        foreignField: '_id',
        as: 'menu'
      }
    },
    {
      $unwind: '$menu'
    },
    {
      $match: {
        'menu.restaurantId': new mongoose.Types.ObjectId(req.params.id),
        'menu.active': true,
        status: 'Available'
      }
    },
    // Project food details
    {
      $project: {
        _id: 1,
        foodName: 1,
        price: 1,
        ingredients: 1,
        instructions: 1,
        cookingTimeMinutes: 1,
        rating: 1,
        imageCover: 1,
        isFeatured: 1,
        status: 1,
        menuId: 1
      }
    },
    // Sort foods
    {
      $sort: { foodName: 1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      restaurant,
      foods: result,
      totalFoods: result.length
    }
  });
});

export const createRestaurant = catchAsync(async (req, res, next) => {
  const { name, license, managerPhone, isDeliveryAvailable } = req.body;

  // 1. Validate required fields
  if (!name || !license || !managerPhone) {
    return next(new AppError('Name, license, and managerId are required.', 400));
  }

  // 2. Validate manager
const managerUser = await User.findOne({ phone: managerPhone });
 
  if (!managerUser || !['Manager'].includes(managerUser.role)) {
    return next(new AppError('managerId must correspond to a user with Manager  role.', 403));
  }

  // 4. Create restaurant
  const newRestaurant = await Restaurant.create({
    name,
    license,
    managerId: managerUser._id,
    isDeliveryAvailable,
  });
  // 5. Populate manager for response
  await newRestaurant.populate({
    path: 'managerId',
    select: 'firstName lastName'
  });

  // 6. Transform response for frontend
  const formattedRestaurant = {
    id: newRestaurant._id,
    name: newRestaurant.name,
    location: newRestaurant.location
      ? {
          address: newRestaurant.location.address || null,
          coordinates: newRestaurant.location.coordinates || [0, 0]
        }
      : null,
    cuisineTypes: newRestaurant.cuisineTypes,
    imageCover: newRestaurant.imageCover,
    description: newRestaurant.description,
    shortDescription: newRestaurant.shortDescription,
    ratingAverage: newRestaurant.ratingAverage,
    ratingQuantity: newRestaurant.ratingQuantity,
    isDeliveryAvailable: newRestaurant.isDeliveryAvailable,
    isOpenNow: newRestaurant.isOpenNow,
    manager: newRestaurant.managerId,
    reviews: newRestaurant.reviews || []
  };

  // 7. Send response
  res.status(201).json({
    status: 'success',
    data: {
      restaurant: formattedRestaurant
    }
  });
});

// Update restaurant by ID
export const updateRestaurant = catchAsync(async (req, res, next) => {
  // 1. Validate restaurant ID
  if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError('Invalid restaurant ID.', 400));
  }

  // 2. Handle image upload if provided
  if (req.file) {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(new AppError('Only JPEG, PNG, or WebP images are allowed.', 400));
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (req.file.size > maxSize) {
      return next(new AppError('Image size must not exceed 5MB.', 400));
    }

    const uploadFromBuffer = (fileBuffer, publicId) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'restaurant_images',
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

    try {
      const publicId = req.params.id.toString();
      const result = await uploadFromBuffer(req.file.buffer, publicId);
      req.body.imageCover = result.secure_url;
    } catch (error) {
      return next(new AppError('Failed to upload image to Cloudinary.', 500));
    }
  }

  // 3. Filter allowed fields for update
  const filteredBody = filterObj(req.body, 'cuisineTypes', 'description', 'imageCover', 'isDeliveryAvailable');

  // 4. Update restaurant
  const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, filteredBody, {
    new: true,
    runValidators: true
  });

  if (!restaurant) {
    return next(new AppError('No restaurant found with that ID.', 404));
  }

  // 5. Populate manager with phone for response
  await restaurant.populate({
    path: 'managerId',
    select: 'firstName lastName phone'
  });

  // 6. Transform response for frontend
  const formattedRestaurant = {
    id: restaurant._id,
    name: restaurant.name,
    location: restaurant.location
      ? {
          address: restaurant.location.address || null,
          coordinates: restaurant.location.coordinates || [0, 0]
        }
      : null,
    cuisineTypes: restaurant.cuisineTypes,
    imageCover: restaurant.imageCover,
    description: restaurant.description,
    shortDescription: restaurant.shortDescription,
    ratingAverage: restaurant.ratingAverage,
    ratingQuantity: restaurant.ratingQuantity,
    isDeliveryAvailable: restaurant.isDeliveryAvailable,
    isOpenNow: restaurant.isOpenNow,
    manager: restaurant.managerId,
    reviews: restaurant.reviews || []
  };

  // 7. Send response
  res.status(200).json({
    status: 'success',
    data: {
      restaurant: formattedRestaurant
    }
  });
});

export const deleteRestaurant = catchAsync(async (req, res, next) => {
  // 1. Validate restaurant ID
  if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError('Invalid restaurant ID.', 400));
  }

  // 2. Soft-delete by setting active: false
  const restaurant = await Restaurant.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true, runValidators: true }
  );

  // 3. Check if restaurant exists
  if (!restaurant) {
    return next(new AppError('No restaurant found with that ID.', 404));
  }

  // 4. Send response
  res.status(204).json({
    status: 'success',
    data: null
  });
});

export const getRestaurantsByManagerId = catchAsync(async (req, res, next) => {
  // 1. Validate manager ID
  const { managerId } = req.params;
  if (!managerId || !mongoose.isValidObjectId(managerId)) {
    return next(new AppError('Invalid manager ID.', 400));
  }

  // 2. Validate manager role
  const managerUser = await User.findById(managerId);
  if (!managerUser || !['Manager', 'Admin'].includes(managerUser.role)) {
    return next(new AppError('Manager ID must correspond to a user with Manager or Admin role.', 403));
  }

  // 3. Build query
  let query = Restaurant.find({ managerId });

  // 4. Conditionally populate reviews
  if (req.query.includeReviews === 'true') {
    query = query.populate({
      path: 'reviews',
      select: 'rating review user createdAt',
      populate: { path: 'user', select: 'firstName lastName' }
    });
  }

  // 5. Populate manager data
  query = query.populate({
    path: 'managerId',
    select: 'firstName lastName phone'
  });

  // 6. Execute query
  const restaurants = await query;

  // 7. Check if restaurants exist
  if (!restaurants.length) {
    return next(new AppError('No restaurants found for the given manager ID.', 404));
  }

  // 8. Transform response for frontend
  const formattedRestaurants = restaurants.map(restaurant => ({
    id: restaurant._id,
    name: restaurant.name,
    location: restaurant.location
      ? {
          address: restaurant.location.address || null,
          coordinates: restaurant.location.coordinates || [0, 0]
        }
      : null,
    cuisineTypes: restaurant.cuisineTypes,
    imageCover: restaurant.imageCover,
    description: restaurant.description,
    shortDescription: restaurant.shortDescription,
    ratingAverage: restaurant.ratingAverage,
    ratingQuantity: restaurant.ratingQuantity,
    isDeliveryAvailable: restaurant.isDeliveryAvailable,
    isOpenNow: restaurant.isOpenNow,
    manager: restaurant.managerId,
    ...(req.query.includeReviews === 'true' && { reviews: restaurant.reviews })
  }));

  // 9. Send response
  res.status(200).json({
    status: 'success',
    results: formattedRestaurants.length,
    data: {
      restaurants: formattedRestaurants
    }
  });
});

// // Get restaurants nearby within a radius (meters)
// export const getNearbyRestaurants = catchAsync(async (req, res, next) => {
//   const { lat, lng, distance } = req.query;

//   if (!lat || !lng) {
//     return next(new AppError('Please provide latitude and longitude in query', 400));
//   }

//   const maxDistance = distance ? parseInt(distance) : 3000; // default 3km radius

//   const restaurants = await Restaurant.find({
//     location: {
//       $near: {
//         $geometry: {
//           type: 'Point',
//           coordinates: [parseFloat(lng), parseFloat(lat)]
//         },
//         $maxDistance: maxDistance
//       }
//     }
//   });

//   res.status(200).json({
//     status: 'success',
//     results: restaurants.length,
//     data: { restaurants }
//   });
// });

// // Aggregate stats by cuisine type
// export const getRestaurantStats = catchAsync(async (req, res, next) => {
//   const stats = await Restaurant.aggregate([
//     { $unwind: '$cuisineTypes' },
//     {
//       $group: {
//         _id: '$cuisineTypes',
//         numRestaurants: { $sum: 1 },
//         avgRating: { $avg: '$ratingAverage' },
//         minDeliveryRadius: { $min: '$deliveryRadiusMeters' },
//         maxDeliveryRadius: { $max: '$deliveryRadiusMeters' }
//       }
//     },
//     { $sort: { numRestaurants: -1 } }
//   ]);

//   res.status(200).json({
//     status: 'success',
//     data: { stats }
//   });
// });

// export const assignRestaurantManager = catchAsync(async (req, res, next) => {
//   const { phone, restaurantId } = req.body;

//   if (!phone || !restaurantId) {
//     return next(new AppError('Phone number and restaurant ID are required', 400));
//   }

//   // 1. Find user by phone number
//   const user = await User.findOne({ phone });

//   if (!user) {
//     return next(new AppError('No user found with that phone number', 404));
//   }

//   // 2. Ensure user has Manager role
//   if (user.role !== 'Manager') {
//     return next(new AppError('User is not a Manager', 400));
//   }

//   // 3. Update restaurant with new manager
//   const restaurant = await Restaurant.findByIdAndUpdate(
//     restaurantId,
//     { managerId: user._id },
//     { new: true, runValidators: true }
//   );

//   if (!restaurant) {
//     return next(new AppError('Restaurant not found', 404));
//   }

//   res.status(200).json({
//     status: 'success',
//     message: `Manager assigned to ${restaurant.name}`,
//     data: {
//       restaurant
//     }
//   });
// });