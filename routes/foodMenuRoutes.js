import express from 'express';
import {
  createMenu,
  getAllMenus,
  getMenu,
  updateMenu,
  deleteMenu
} from '../controllers/foodMenuController.js';

const router = express.Router();

router.route('/')
  .get(getAllMenus)
  .post(createMenu);

router.route('/:id')
  .get(getMenu)
  .patch(updateMenu)
  .delete(deleteMenu);

export default router;
