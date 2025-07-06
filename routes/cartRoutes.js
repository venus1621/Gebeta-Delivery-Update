import express from 'express';
import {
  createCart,
  getAllCarts,
  getCart,
  addToCart,
  updateCart,
  removeItemFromCart,
  deleteCart
} from '../controllers/cartController.js';

const router = express.Router();

router.route('/')
  .get(getAllCarts)         // Admin
  .post(createCart);        // Optional base creation

router.route('/add')
  .post(addToCart);         // Smart add (existing cart or new)

router.route('/:id')
  .get(getCart)
  .patch(updateCart)
  .delete(deleteCart);

router.route('/:cartId/item/:foodId')
  .delete(removeItemFromCart); // Remove one item from cart

export default router;
