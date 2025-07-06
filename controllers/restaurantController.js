import Restaurant from '../models/restaurantModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import APIFeatures from '../utils/apiFeatures.js';
import User from '../models/userModel.js';
// Alias for top 5 rated restaurants
export const aliasTopRestaurants = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingAverage,deliveryRadiusMeters';
  req.query.fields = 'name,location,ratingAverage,cuisineTypes,deliveryRadiusMeters';
  next();
};

// Get all restaurants with filtering, sorting, pagination & search
export const getAllRestaurants = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Restaurant.find(), req.query)
    .searchBy('name')
    .filter()
    .sort()
    .limitFields();

  const restaurants = await features.query;

  res.status(200).json({
    status: 'success',
    results: restaurants.length,
    data: { restaurants }
  });
});

// Get one restaurant by ID
export const getRestaurant = catchAsync(async (req, res, next) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    return next(new AppError('No restaurant found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { restaurant }
  });
});

// Create new restaurant
export const createRestaurant = catchAsync(async (req, res, next) => {
  const { manager } = req.body;

  // 1. Validate manager ID
  if (!manager) {
    return next(new AppError('A manager ID must be provided to create a restaurant.', 400));
  }

  const managerUser = await User.findById(manager);
  if (!managerUser) {
    return next(new AppError('Manager ID does not exist.', 400));
  }

  // Optional: Check role of manager
  if (managerUser.role !== 'Manager' && managerUser.role !== 'Admin') {
    return next(new AppError('Only users with the role "Manager" or "Admin" can manage a restaurant.', 403));
  }

  // 2. Create the restaurant
  const newRestaurant = await Restaurant.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      restaurant: newRestaurant
    }
  });
});

// Update restaurant by ID
export const updateRestaurant = catchAsync(async (req, res, next) => {
  const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!restaurant) {
    return next(new AppError('No restaurant found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { restaurant }
  });
});

// Delete restaurant by ID
export const deleteRestaurant = catchAsync(async (req, res, next) => {
  const restaurant = await Restaurant.findByIdAndDelete(req.params.id);

  if (!restaurant) {
    return next(new AppError('No restaurant found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get restaurants nearby within a radius (meters)
export const getNearbyRestaurants = catchAsync(async (req, res, next) => {
  const { lat, lng, distance } = req.query;

  if (!lat || !lng) {
    return next(new AppError('Please provide latitude and longitude in query', 400));
  }

  const maxDistance = distance ? parseInt(distance) : 3000; // default 3km radius

  const restaurants = await Restaurant.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        },
        $maxDistance: maxDistance
      }
    }
  });

  res.status(200).json({
    status: 'success',
    results: restaurants.length,
    data: { restaurants }
  });
});

// Aggregate stats by cuisine type
export const getRestaurantStats = catchAsync(async (req, res, next) => {
  const stats = await Restaurant.aggregate([
    { $unwind: '$cuisineTypes' },
    {
      $group: {
        _id: '$cuisineTypes',
        numRestaurants: { $sum: 1 },
        avgRating: { $avg: '$ratingAverage' },
        minDeliveryRadius: { $min: '$deliveryRadiusMeters' },
        maxDeliveryRadius: { $max: '$deliveryRadiusMeters' }
      }
    },
    { $sort: { numRestaurants: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: { stats }
  });
});











// import Restaurant from '../models/Restaurant.js';

// // CREATE a restaurant
// export const createRestaurant = async (req, res) => {
//   try {
//     const restaurant = await Restaurant.create(req.body);
//     res.status(201).json({ status: 'success', data: restaurant });
//   } catch (err) {
//     res.status(400).json({ status: 'fail', message: err.message });
//   }
// };

// // READ all restaurants
// export const getAllRestaurants = async (req, res) => {
//   try {
//     const restaurants = await Restaurant.find().populate('managerId');
//     res.status(200).json({ status: 'success', results: restaurants.length, data: restaurants });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ status: 'error', message: err.message });
//   }
// };

// // READ one restaurant by ID
// export const getRestaurant = async (req, res) => {
//   try {
//     const restaurant = await Restaurant.findById(req.params.id).populate('managerId');
//     if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

//     res.status(200).json({ status: 'success', data: restaurant });
//   } catch (err) {
//     res.status(500).json({ status: 'error', message: err.message });
//   }
// };

// // UPDATE a restaurant
// export const updateRestaurant = async (req, res) => {
//   try {
//     const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//       runValidators: true
//     });
//     if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

//     res.status(200).json({ status: 'success', data: restaurant });
//   } catch (err) {
//     res.status(400).json({ status: 'fail', message: err.message });
//   }
// };

// // DELETE a restaurant
// export const deleteRestaurant = async (req, res) => {
//   try {
//     const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
//     if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

//     res.status(204).json({ status: 'success', data: null });
//   } catch (err) {
//     res.status(500).json({ status: 'error', message: err.message });
//   }
// };



