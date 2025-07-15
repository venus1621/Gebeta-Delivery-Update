// utils/uploadFoodImage.js
import multer from 'multer';
import cloudinary from './cloudinary.js';
import streamifier from 'streamifier';

// Memory storage for file buffer
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// Cloudinary buffer upload utility
export const uploadImageToCloudinary = (buffer, folder = 'food_images') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};
