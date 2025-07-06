import mongoose from 'mongoose';

const socialMediaSchema = new mongoose.Schema({
  likes: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('SocialMedia', socialMediaSchema);
