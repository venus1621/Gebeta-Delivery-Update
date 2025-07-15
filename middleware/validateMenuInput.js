import { body, validationResult } from 'express-validator';
import Restaurant from '../models/restaurantModel.js';

export const validateMenuInput = (fields) => [
  ...fields.map((field) =>
    body(field).notEmpty().withMessage(`${field} is required`)
  ),
  body('restaurantId').custom(async (value) => {
    const restaurant = await Restaurant.findById(value);
    if (!restaurant) throw new Error('Invalid restaurantId');
    return true;
  }),
  body('menuType').isIn(['Breakfast', 'Lunch', 'Dinner', 'Special', 'Seasonal']).withMessage('Invalid menuType'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'fail', errors: errors.array() });
    }
    next();
  },
];