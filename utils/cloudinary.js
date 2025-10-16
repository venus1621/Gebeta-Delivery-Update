// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import streamifier from 'streamifier';
import sharp from 'sharp';

dotenv.config(); // Load environment variables

// ===========================================
// 🌩️ Cloudinary Configuration
// ===========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'drinuph9d',
  api_key: process.env.CLOUDINARY_API_KEY || '548244297886642',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'lg4YSY0FzIkfgTi9Et3_c1VQBFI',
});

// ===========================================
// 🧩 Universal Image Uploader (with WebP Resize)
// ===========================================
/**
 * Resize, compress, and upload an image buffer to Cloudinary in WebP format.
 *
 * @param {Buffer} fileBuffer - The image file buffer (from Multer).
 * @param {Object} options - { folder, publicId, width, height, quality }
 * @returns {Promise<Object>} Cloudinary upload result.
 */
export const uploadImageToCloudinary = async (
  fileBuffer,
  {
    folder = 'uploads', // default folder
    publicId = Date.now().toString(), // unique fallback id
    width = 800, // standard resize width
    height = 800, // standard resize height
    quality = 80, // compression quality
  } = {}
) => {
  try {
    // 1️⃣ Resize and convert to WebP using Sharp
    const processedBuffer = await sharp(fileBuffer)
      .resize(width, height, { fit: 'cover' })
      .toFormat('webp', { quality })
      .toBuffer();

    // 2️⃣ Upload to Cloudinary from the resized buffer
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: true,
          resource_type: 'image',
          format: 'webp', // force WebP format
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload failed:', error.message);
            return reject(new Error(`Cloudinary Upload Error: ${error.message}`));
          }
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
          });
        }
      );

      streamifier.createReadStream(processedBuffer).pipe(uploadStream);
    });
  } catch (err) {
    console.error('Error during image upload:', err);
    throw err;
  }
};

// ===========================================
// 🧹 Delete an Image from Cloudinary
// ===========================================
/**
 * Deletes an image by its publicId from Cloudinary.
 * @param {string} publicId - The Cloudinary public ID.
 * @returns {Promise<Object>} Deletion result.
 */
export const deleteImageFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (err) {
    console.error('Error deleting Cloudinary image:', err);
    throw err;
  }
};

// ===========================================
// Export Cloudinary instance
// ===========================================
export default cloudinary;
