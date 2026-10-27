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
      enum: [
        'admin',
        'manager',
        'executive',
        'owner',
        'member',
        'studio_owner',
        'project_owner',
        'vendor_owner',
      ],
      default: 'executive',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
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
    deactivationReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only have one membership record per tenant
tenantUserSchema.index({ userId: 1, tenantId: 1 }, { unique: true });

// Enforce strictly one active Admin per tenant workspace
tenantUserSchema.pre('save', async function (next) {
  const adminRoles = ['admin', 'owner', 'studio_owner'];
  if (adminRoles.includes(this.role) && this.status === 'active') {
    const existingAdmin = await mongoose.models.TenantUser.findOne({
      tenantId: this.tenantId,
      role: { $in: adminRoles },
      status: 'active',
      _id: { $ne: this._id },
    });

    if (existingAdmin) {
      const err = new Error('This workspace already has an active Administrator. Each tenant can only have one Admin.');
      err.statusCode = 409;
      err.code = 'CONFLICT';
      return next(err);
    }
  }
  next();
});

export const TenantUser = mongoose.model('TenantUser', tenantUserSchema);
