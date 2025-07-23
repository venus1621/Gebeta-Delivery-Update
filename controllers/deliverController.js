import Deliver from '../models/Deliver.js';
import Order from '../models/Order.js';


// export const createDelivery = async (req, res, next) => {
//   try {
//     const deliveryPersonId = req.user._id;
//     const { orderId } = req.body;

//     // 1. Validate inputs
//     if (!orderId) {
//       return res.status(400).json({ message: 'Order ID are required.' });
//     }

//     // 2. Check if order exists and is in a valid state
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({ message: 'Order not found.' });
//     }

//     if (order.orderStatus !== 'Cooked') {
//       return res.status(400).json({ message: `Order must be in 'Cooked' status before delivery.` });
//     }

//     // 3. Create a new delivery record and assign delivery person
//     const delivery = await Deliver.create({
//       orderId,
//       deliveryPerson: deliveryPersonId,
//       status: 'Assigned', // or 'Delivering'
//     });

//     // 4. Update order status to 'Delivering'
//     order.orderStatus = 'Delivering';
//     await order.save();

//     res.status(201).json({
//       message: 'Delivery created and assigned successfully.',
//       delivery,
//     });
//   } catch (error) {
//     console.error('Delivery creation error:', error);
//     res.status(500).json({ message: 'Something went wrong while creating delivery.' });
//   }
// };



// ✅ Get all deliveries (with user and cart info)

export const createDelivery = async (req, res, next) => {
  try {
    const deliveryPersonId = req.user._id; // Assume from auth middleware
    const { orderId } = req.body;

    // 1. Validate input
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required.' });
    }

    // 2. Check if the order exists and is ready (Cooked)
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.orderStatus !== 'Cooked') {
      return res.status(400).json({ message: 'Order must be in "Cooked" status to start delivery.' });
    }

    // 3. Check if delivery already exists for this order
    const existingDelivery = await Deliver.findOne({ orderId });
    if (existingDelivery) {
      return res.status(400).json({ message: 'Delivery already assigned for this order.' });
    }

    // 4. Create delivery entry
    const delivery = await Deliver.create({
      deliveryPerson: deliveryPersonId,
      orderId,
      deliveryStatus: 'Assigned',
    });

    // 5. Update order status to 'Delivering'
    order.orderStatus = 'Delivering';
    await order.save();

    res.status(201).json({
      message: 'Delivery successfully created and assigned.',
      delivery,
    });
  } catch (error) {
    console.error('Error creating delivery:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
export const assignDeliveryToOrder = async (req, res, next) => {
  try {
    const deliveryPersonId = req.user._id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required.' });
    }

    // 1. Check if order exists and not already assigned
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.deliveryId) {
      return res.status(409).json({ message: 'Delivery already assigned to this order.' });
    }

    // 2. Create delivery assignment
    const delivery = await Deliver.create({
      deliveryPerson: deliveryPersonId,
      orderId,
      deliveryStatus: 'Assigned',
    });

    // 3. Update the order without triggering full validation
    await Order.findByIdAndUpdate(
      orderId,
      {
        deliveryId: delivery._id,
        orderStatus: 'Delivering',
      },
      {
        new: true,
        runValidators: false, // avoid requiring other fields
      }
    );

    res.status(201).json({
      message: 'Delivery person assigned successfully.',
      delivery,
    });
  } catch (error) {
    next(error);
  }
};


export const cancelDeliveryAssignment = async (req, res, next) => {
  try {
    const deliveryPersonId = req.user._id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required.' });
    }

    // Find the delivery record assigned to this user and order
    const delivery = await Deliver.findOne({ orderId, deliveryPerson: deliveryPersonId });

    if (!delivery) {
      return res.status(404).json({ message: 'No delivery assignment found for this order and user.' });
    }

    if (delivery.deliveryStatus === 'Cancelled') {
      return res.status(400).json({ message: 'Delivery is already cancelled.' });
    }

    // Update delivery status to Cancelled
    delivery.deliveryStatus = 'Cancelled';
    await delivery.save();

    // Update the order: remove deliveryId and revert status to 'Cooked' (or 'Pending' as you prefer)
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    order.deliveryId = null;
    order.orderStatus = 'Cooked'; // revert back to cooked, waiting for another delivery assignment
    await order.save();

    res.status(200).json({
      status: 'success',
      message: 'Delivery assignment cancelled and order reverted.',
      data: {
        delivery,
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

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
