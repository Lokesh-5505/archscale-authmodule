import mongoose from 'mongoose';
import { SESSION_LIMITS } from '../config/constants.js';

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      index: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    supabaseSessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    supabaseUserId: {
      type: String,
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    membershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      default: null,
      index: true,
    },
    activeTenantUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TenantUser',
      default: null,
    },
    rememberMe: {
      type: Boolean,
      default: true,
    },
    deviceLabel: {
      type: String,
      default: 'Unknown Device',
    },
    userAgentSummary: {
      type: String,
      default: '',
    },
    device: {
      raw: { type: String, default: '' },
      browser: { type: String, default: 'Unknown' },
      os: { type: String, default: 'Unknown' },
      deviceType: { type: String, default: 'desktop' },
      model: { type: String },
      vendor: { type: String },
    },
    ip: {
      type: String,
      default: '127.0.0.1',
    },
    ipAddressHash: {
      type: String,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedReason: {
      type: String,
      default: null,
    },
    revocationReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Synchronize sessionId, lastSeenAt, and revocationReason
sessionSchema.pre('save', function (next) {
  if (!this.sessionId) {
    this.sessionId = this._id.toString();
  }
  if (this.lastActiveAt) {
    this.lastSeenAt = this.lastActiveAt;
  }
  if (this.revokedReason && !this.revocationReason) {
    this.revocationReason = this.revokedReason;
  } else if (this.revocationReason && !this.revokedReason) {
    this.revokedReason = this.revocationReason;
  }
  next();
});

// Method to verify if session is active, unrevoked, unexpired, and not idle
sessionSchema.methods.isValid = function () {
  if (this.revokedAt) return false;

  const now = new Date();
  if (now > this.expiresAt) return false;

  // Idle limit check
  const idleHoursAllowed = this.rememberMe
    ? SESSION_LIMITS.REMEMBERED_IDLE_DAYS * 24
    : SESSION_LIMITS.EPHEMERAL_IDLE_HOURS;

  const maxIdleMs = idleHoursAllowed * 60 * 60 * 1000;
  const activeTime = this.lastSeenAt || this.lastActiveAt;
  const timeSinceActiveMs = now.getTime() - new Date(activeTime).getTime();

  return timeSinceActiveMs <= maxIdleMs;
};

export const Session = mongoose.model('Session', sessionSchema);
