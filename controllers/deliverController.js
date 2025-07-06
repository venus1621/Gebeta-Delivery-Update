import Deliver from '../models/Deliver.js';


// ✅ Create a delivery record
export const createDelivery = async (req, res) => {
  try {
    const delivery = await Deliver.create(req.body);
    res.status(201).json({ status: 'success', data: delivery });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
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
