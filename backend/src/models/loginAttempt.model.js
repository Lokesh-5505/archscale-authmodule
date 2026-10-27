import mongoose from 'mongoose';
import { SECURITY_RULES } from '../config/constants.js';

const loginAttemptSchema = new mongoose.Schema(
  {
    idTarget: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: SECURITY_RULES.LOCKOUT_DURATION_MINUTES * 60, // 15-minute TTL
    },
  },
  {
    timestamps: false,
  }
);

export const LoginAttempt = mongoose.model('LoginAttempt', loginAttemptSchema);
