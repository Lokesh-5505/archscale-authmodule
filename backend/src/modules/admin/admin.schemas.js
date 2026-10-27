import { z } from 'zod';
import { TENANT_TYPES, SECURITY_RULES } from '../../config/constants.js';

export const createInvitationSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  tenantType: z.string().optional().default(TENANT_TYPES.STUDIO_OWNER),
  organizationName: z.string().trim().optional().default(''),
  membershipStartsAt: z.string().or(z.date()).optional().default(() => new Date()),
  membershipEndsAt: z.string().or(z.date()).refine((val) => {
    const end = new Date(val);
    return !isNaN(end.getTime()) && end > new Date();
  }, { message: 'Membership end date must be in the future' }),
  mode: z.enum(['invite', 'manual']).default('invite'),
  prefill: z.object({
    fullName: z.string().trim().optional(),
    organizationName: z.string().trim().optional(),
  }).optional(),
});

export const manualUserCreationSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  userId: z
    .string()
    .min(3, 'User ID must be at least 3 characters')
    .max(30, 'User ID cannot exceed 30 characters')
    .regex(SECURITY_RULES.USER_ID_REGEX, 'User ID contains invalid characters')
    .optional(),
  username: z.string().optional(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MEMBER']).default('MEMBER'),
  organizationId: z.string().optional(),
  tenantId: z.string().optional(),
  membershipEndsAt: z.string().or(z.date()).optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').trim(),
  tenantName: z.string().trim().optional().default('Primary Workspace'),
  tenantType: z.string().optional().default('studio_owner'),
});

export const updateMembershipSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'expired', 'revoked']).optional(),
  expiresAt: z.string().or(z.date()).optional(),
  endsAt: z.string().or(z.date()).optional(),
});
