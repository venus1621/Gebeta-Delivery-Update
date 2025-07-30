import streamifier from 'streamifier';
import cloudinary from '../utils/cloudinary.js';

const uploadRestaurantImage = async (req, res, next) => {
  if (!req.file) return next();

  const uploadFromBuffer = (fileBuffer, publicId) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'restaurant_images',
          public_id: publicId,
          overwrite: true,
          resource_type: 'image'
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      streamifier.createReadStream(fileBuffer).pipe(stream);
    });

  try {
    const publicId = req.params.id || `restaurant-${Date.now()}`;
    const result = await uploadFromBuffer(req.file.buffer, publicId);
    req.body.imageCover = result.secure_url; // put image URL here
    next();
  } catch (error) {
    next(error);
  }
};

export default uploadRestaurantImage;
