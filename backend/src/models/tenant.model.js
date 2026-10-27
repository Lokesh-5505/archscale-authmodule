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
      enum: ['active', 'deactivated', 'suspended', 'expired'],
      default: 'active',
      index: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    statusReason: {
      type: String,
      default: '',
    },
    tenantType: {
      type: String,
      default: 'admin',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Tenant = mongoose.model('Tenant', tenantSchema);
