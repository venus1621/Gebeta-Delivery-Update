import Deliver from '../models/Deliver.js';
import axios from 'axios';

import Order from '../models/Order.js';

export const createDelivery = async (req, res, next) => {
  try {
    const deliveryPersonId = req.user._id;
    const { orderId, location: userLocation } = req.body;

    // 1. Validate inputs
    if (!orderId || !userLocation?.lat || !userLocation?.lng) {
      return res.status(400).json({ message: 'Order ID and valid location are required.' });
    }

    // 2. Find the order and populate restaurant
    const order = await Order.findById(orderId).populate('restaurant');
    if (!order || !order.restaurant) {
      return res.status(404).json({ message: 'Order or associated restaurant not found.' });
    }

    const restaurant = order.restaurant;
    const restCoords = [restaurant.location.lng, restaurant.location.lat];
    const userCoords = [userLocation.lng, userLocation.lat];

    // 3. Calculate driving distance using OSRM API
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userCoords[0]},${userCoords[1]};${restCoords[0]},${restCoords[1]}?overview=false`;
    const osrmResponse = await axios.get(osrmUrl);

    const distanceInMeters = osrmResponse?.data?.routes?.[0]?.distance;
    if (!distanceInMeters) {
      return res.status(500).json({ message: 'Failed to calculate distance using OSRM.' });
    }

    // 4. Delivery pricing logic
    const deliveryPrice = Math.ceil((distanceInMeters / 100) * 50); // 50 Birr per 100m

    // 5. Create and save delivery record
    const delivery = await Deliver.create({
      deliveryPersonId,
      orderId,
      deliveryPrice,
      location: userLocation,
    });

    // 6. Response
    res.status(201).json({
      message: 'Delivery created successfully',
      delivery,
      distanceInMeters,
      deliveryPrice,
    });

  } catch (error) {
    console.error('Error in createDelivery:', error.message);
    res.status(500).json({
      message: 'Failed to create delivery',
      error: error.message,
    });
  }
};


// ✅ Get all deliveries (with user and cart info)
export const getAllDeliveries = async (req, res) => {
  try {
    const deliveries = await Deliver.find()
      .populate('deliveryPersonId')
      .populate('cartId');

    res.status(200).json({
      status: 'success',
      results: deliveries.length,
      data: deliveries
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ✅ Get one delivery by ID
export const getDelivery = async (req, res) => {
  try {
    const delivery = await Deliver.findById(req.params.id)
      .populate('deliveryPersonId')
      .populate('cartId');

    if (!delivery) {
      return res.status(404).json({ status: 'fail', message: 'Delivery not found' });
    }

    res.status(200).json({ status: 'success', data: delivery });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ✅ Update delivery (feedback, rating, price)
export const updateDelivery = async (req, res) => {
  try {
    const delivery = await Deliver.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('deliveryPersonId')
      .populate('cartId');

    if (!delivery) {
      return res.status(404).json({ status: 'fail', message: 'Delivery not found' });
    }

    res.status(200).json({ status: 'success', data: delivery });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// ✅ Delete a delivery record
export const deleteDelivery = async (req, res) => {
  try {
    const delivery = await Deliver.findByIdAndDelete(req.params.id);
    if (!delivery) {
      return res.status(404).json({ status: 'fail', message: 'Delivery not found' });
    }

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
