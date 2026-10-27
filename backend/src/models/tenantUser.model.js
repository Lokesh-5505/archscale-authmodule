import mongoose from 'mongoose';

const tenantUserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'owner',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only have one membership record per tenant
tenantUserSchema.index({ userId: 1, tenantId: 1 }, { unique: true });

export const TenantUser = mongoose.model('TenantUser', tenantUserSchema);
