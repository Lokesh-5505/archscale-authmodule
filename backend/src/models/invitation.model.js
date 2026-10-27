import mongoose from 'mongoose';
import { TENANT_TYPES } from '../config/constants.js';

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    inviteLink: {
      type: String,
      default: '',
    },
    tenantType: {
      type: String,
      required: true,
      enum: Object.values(TENANT_TYPES),
    },
    organizationName: {
      type: String,
      trim: true,
      default: '',
    },
    membershipStartsAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    membershipEndsAt: {
      type: Date,
      required: true,
    },
    mode: {
      type: String,
      enum: ['invite', 'manual'],
      default: 'invite',
    },
    prefill: {
      fullName: { type: String, trim: true },
      organizationName: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index on email and status for pending lookups
invitationSchema.index({ email: 1, status: 1 });

export const Invitation = mongoose.model('Invitation', invitationSchema);
