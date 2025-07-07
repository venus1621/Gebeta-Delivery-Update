import Cart from '../models/Cart.js';
import Food from '../models/Food.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';


const calculateTotalPrice = async (orderItems) => {
  let total = 0;
  for (const item of orderItems) {
    const food = await Food.findById(item.foodId);
    if (food) {
      total += food.price * item.quantity;
    }
  }
  return mongoose.Types.Decimal128.fromString(total.toFixed(2));
};
// 🛒 Create a new cart
export const createCart = async (req, res) => {
  try {
    const cart = await Cart.create(req.body);
    res.status(201).json({ status: 'success', data: cart });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// 🧾 Get all carts (admin)
export const getAllCarts = async (req, res) => {
  try {
    const carts = await Cart.find()
    //   .populate('userId')
    //   .populate('orderItems.foodId');
    res.status(200).json({ status: 'success', results: carts.length, data: carts });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// 🧺 Get one cart by ID
export const getCart = async (req, res) => {
  try {
    const cart = await Cart.findById(req.params.id)
      .populate('userId')
      .populate('orderItems.foodId');
    if (!cart) return res.status(404).json({ status: 'fail', message: 'Cart not found' });
    res.status(200).json({ status: 'success', data: cart });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ➕ Add or update item(s) in cart
export const addToCart = async (req, res) => {
  try {
    const { userId, foodId, quantity } = req.body;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // 🔸 Create new cart
      cart = await Cart.create({
        userId,
        orderItems: [{ foodId, quantity }]
      });
    } else {
      // 🔸 Update existing cart
      const existingItem = cart.orderItems.find(item => item.foodId.toString() === foodId);
      if (existingItem) {
        existingItem.quantity += quantity || 1;
      } else {
        cart.orderItems.push({ foodId, quantity });
      }
      await cart.save();
    }

    const totalPrice = await calculateTotalPrice(cart.orderItems);

    // 🔄 Create or Update Transaction
    const transaction = await Transaction.findOneAndUpdate(
      { cart_id: cart._id },
      {
        cart_id: cart._id,
        Total_Price: totalPrice,
        Status: 'Pending',
        Created_At: new Date()
      },
      { upsert: true, new: true }
    );

    const populatedCart = await cart.populate('orderItems.foodId');

    res.status(200).json({
      status: 'success',
      cart: populatedCart,
      transaction
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};


// 🛠 Update cart (e.g. change status or delivery address)
export const updateCart = async (req, res) => {
  try {
    const cart = await Cart.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('orderItems.foodId userId');

    if (!cart) return res.status(404).json({ status: 'fail', message: 'Cart not found' });

    res.status(200).json({ status: 'success', data: cart });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// 🗑 Remove item from cart
export const removeItemFromCart = async (req, res) => {
  try {
    const { cartId, foodId } = req.params;

    const cart = await Cart.findById(cartId);
    if (!cart) return res.status(404).json({ status: 'fail', message: 'Cart not found' });

    cart.orderItems = cart.orderItems.filter(item => item.foodId.toString() !== foodId);
    await cart.save();

    const populatedCart = await cart.populate('orderItems.foodId');
    res.status(200).json({ status: 'success', data: populatedCart });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// 🗑 Delete entire cart
export const deleteCart = async (req, res) => {
  try {
    const cart = await Cart.findByIdAndDelete(req.params.id);
    if (!cart) return res.status(404).json({ status: 'fail', message: 'Cart not found' });

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
