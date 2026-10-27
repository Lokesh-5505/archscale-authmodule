import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
      default: null,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'MEMBER', 'OWNER', 'owner'],
      default: 'MEMBER',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'expired', 'revoked'],
      default: 'active',
      index: true,
    },
    startsAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Synchronize endsAt and expiresAt
membershipSchema.pre('validate', function (next) {
  if (this.endsAt && !this.expiresAt) {
    this.expiresAt = this.endsAt;
  } else if (this.expiresAt && !this.endsAt) {
    this.endsAt = this.expiresAt;
  }
  next();
});

// Method to determine if access is currently valid
membershipSchema.methods.isActive = function () {
  if (this.status !== 'active') return false;
  const now = new Date();
  const effectiveEnd = this.expiresAt || this.endsAt;
  if (effectiveEnd && now > effectiveEnd) return false;
  if (this.startsAt && now < this.startsAt) return false;
  return true;
};

export const Membership = mongoose.model('Membership', membershipSchema);
