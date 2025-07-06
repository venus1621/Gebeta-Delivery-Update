// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

cloudinary.config({
  cloud_name: 'drinuph9d',
  api_key: '548244297886642',
  api_secret: 'lg4YSY0FzIkfgTi9Et3_c1VQBFI'
});


export default cloudinary;
