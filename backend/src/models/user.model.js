import mongoose from 'mongoose';
import { PLATFORM_ROLES, SECURITY_RULES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    supabaseUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      match: [SECURITY_RULES.USER_ID_REGEX, 'Invalid User ID format'],
    },
    userIdLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      index: true,
    },
    usernameLower: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    platformRole: {
      type: String,
      enum: [PLATFORM_ROLES.SUPER_ADMIN, PLATFORM_ROLES.ADMIN, null],
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      index: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    lastContextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TenantUser',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (!ret.username && ret.userId) {
          ret.username = ret.userId;
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Pre-save to ensure username and userId are synchronized and lowercased
userSchema.pre('validate', function (next) {
  if (!this.userId && this.username) {
    this.userId = this.username;
  }
  if (!this.username && this.userId) {
    this.username = this.userId;
  }
  if (this.userId) {
    this.userIdLower = this.userId.toLowerCase();
    this.usernameLower = this.userIdLower;
  }
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Virtual for initials (e.g. "ArchScale Admin" -> "AA")
userSchema.virtual('initials').get(function () {
  if (!this.fullName) return 'AS';
  const parts = this.fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

export const User = mongoose.model('User', userSchema);
