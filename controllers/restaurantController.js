import Restaurant from '../models/restaurantModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import APIFeatures from '../utils/apiFeatures.js';
import User from '../models/userModel.js';
import axios from 'axios';
import NodeGeocoder from 'node-geocoder';
// Alias for top 5 rated restaurants
export const aliasTopRestaurants = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingAverage,deliveryRadiusMeters';
  req.query.fields = 'name,location,ratingAverage,cuisineTypes,deliveryRadiusMeters';
  next();
};
const geocoder = NodeGeocoder({
  provider: 'openstreetmap'
});


export const getRestaurantsWithDistanceFromCoords = catchAsync(async (req, res, next) => {
  const { lng, lat } = req.query;

  if (!lng || !lat) {
    return next(new AppError('Please provide longitude (lng) and latitude (lat) in query.', 400));
  }

  const userCoords = [parseFloat(lng), parseFloat(lat)];

  // Fetch all active restaurants
  const restaurants = await Restaurant.find({ active: true });

  // Map over restaurants and get distance & duration from OSRM
  const results = await Promise.all(
    restaurants.map(async (restaurant) => {
      const restCoords = restaurant.location.coordinates; // [lng, lat]

      try {
        // OSRM route API to get driving distance and duration
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userCoords[0]},${userCoords[1]};${restCoords[0]},${restCoords[1]}?overview=false`;
        const response = await axios.get(osrmUrl);

        const route = response.data.routes?.[0];
        const distance = route?.distance || null; // meters
        const duration = route?.duration || null; // seconds

        return {
          ...restaurant.toObject(),
          distanceMeters: distance ? Math.round(distance) : null,
          durationMinutes: duration ? Math.round(duration / 60) : null
        };
      } catch (error) {
        console.error('OSRM Error:', error.message);
        return {
          ...restaurant.toObject(),
          distanceMeters: null,
          durationMinutes: null
        };
      }
    })
  );

  // Sort by nearest distance first
  const sorted = results.filter(r => r.distanceMeters !== null)
                        .sort((a, b) => a.distanceMeters - b.distanceMeters);

  res.status(200).json({
    status: 'success',
    results: sorted.length,
    data: sorted
  });
});
// Get all restaurants with filtering, sorting, pagination & search
export const getAllRestaurants = catchAsync(async (req, res, next) => {
  // Create an instance of APIFeatures with the base query and request query
  const features = new APIFeatures(Restaurant.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Execute the query and populate the manager data
  const restaurants = await features.query.populate('managerId');

  // Send response
  res.status(200).json({
    status: 'success',
    results: restaurants.length,
    data: {
      restaurants,
    },
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
// export const createRestaurant = catchAsync(async (req, res, next) => {
//   const { manager } = req.body;

//   // 1. Validate manager ID
//   if (!manager) {
//     return next(new AppError('A manager ID must be provided to create a restaurant.', 400));
//   }

//   const managerUser = await User.findById(manager);
//   if (!managerUser) {
//     return next(new AppError('Manager ID does not exist.', 400));
//   }

//   // Optional: Check role of manager
//   if (managerUser.role !== 'Manager' && managerUser.role !== 'Admin') {
//     return next(new AppError('Only users with the role "Manager" or "Admin" can manage a restaurant.', 403));
//   }

//   // 2. Create the restaurant
//   const newRestaurant = await Restaurant.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       restaurant: newRestaurant
//     }
//   });
// });

export const createRestaurant = catchAsync(async (req, res, next) => {
  const {
    name,
    license,
    manager, // sent from client
    cuisineTypes,
    deliveryRadiusMeters,
    openHours,
    isDeliveryAvailable,
    isOpenNow,
    location
  } = req.body;

  // Validate manager
  if (!manager) {
    return next(new AppError('A manager ID must be provided to create a restaurant.', 400));
  }

  const managerUser = await User.findById(manager);
  if (!managerUser || (managerUser.role !== 'Manager' && managerUser.role !== 'Admin')) {
    return next(new AppError('Only a Manager or Admin can manage a restaurant.', 403));
  }

  // Handle location
  if (!location || !location.address || !location.coordinates) {
    return next(new AppError('Location with address and coordinates is required.', 400));
  }

  const coordinates = Array.isArray(location.coordinates)
    ? location.coordinates.map(coord => parseFloat(coord))
    : [NaN, NaN];

  if (coordinates.length !== 2 || coordinates.some(isNaN)) {
    return next(new AppError('Coordinates must be valid [longitude, latitude] numbers.', 400));
  }

  const parsedLocation = {
    type: 'Point',
    coordinates,
    address: location.address,
    description: location.description || ''
  };

  // Create the restaurant
  const newRestaurant = await Restaurant.create({
    name,
    license,
    cuisineTypes,
    deliveryRadiusMeters,
    openHours,
    isDeliveryAvailable,
    isOpenNow,
    managerId: manager,
    location: parsedLocation
  });

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



