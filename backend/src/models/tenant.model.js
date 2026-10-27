import mongoose from 'mongoose';
import { TENANT_TYPES } from '../config/constants.js';

const tenantSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Primary Workspace',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'expired'],
      default: 'active',
      index: true,
    },
    tenantType: {
      type: String,
      enum: Object.values(TENANT_TYPES),
      default: TENANT_TYPES.STUDIO_OWNER,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Tenant = mongoose.model('Tenant', tenantSchema);
