import { z } from 'zod';
import { SECURITY_RULES, COMMON_PASSWORDS } from '../../config/constants.js';

const passwordValidator = z
  .string()
  .min(SECURITY_RULES.MIN_PASSWORD_LENGTH, `Password must be at least ${SECURITY_RULES.MIN_PASSWORD_LENGTH} characters`)
  .refine((val) => !COMMON_PASSWORDS.has(val.toLowerCase()), {
    message: 'This password is too common or easily guessed. Please choose a stronger password.',
  });

export const loginSchema = z
  .object({
    id: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
    userId: z.string().optional(),
    password: z.string().min(1, 'Please enter your password'),
    rememberMe: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      const val = (data.username || data.email || data.id || data.userId || '').trim();
      return val.length > 0;
    },
    {
      message: 'Please enter your username, email, or User ID',
      path: ['username'],
    }
  )
  .transform((data) => {
    const identifier = (data.username || data.email || data.id || data.userId || '').trim();
    return {
      ...data,
      id: identifier,
      username: identifier,
    };
  });

export const invitationLookupSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1, 'Invitation token is required'),
    userId: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(
        SECURITY_RULES.USER_ID_REGEX,
        'Username may only contain letters, numbers, underscores (_), and periods (.)'
      )
      .optional(),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(
        SECURITY_RULES.USER_ID_REGEX,
        'Username may only contain letters, numbers, underscores (_), and periods (.)'
      )
      .optional(),
    fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
    password: passwordValidator,
    organizationName: z.string().trim().optional(),
  })
  .refine((data) => !!(data.userId || data.username), {
    message: 'Please choose a username',
    path: ['username'],
  })
  .transform((data) => {
    const chosen = (data.username || data.userId || '').trim();
    return {
      ...data,
      userId: chosen,
      username: chosen,
    };
  });

export const forgotPasswordSchema = z
  .object({
    id: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
  })
  .refine(
    (data) => {
      const val = (data.username || data.email || data.id || '').trim();
      return val.length > 0;
    },
    {
      message: 'Please enter your username or email address',
      path: ['username'],
    }
  )
  .transform((data) => {
    const identifier = (data.username || data.email || data.id || '').trim();
    return {
      ...data,
      id: identifier,
      username: identifier,
    };
  });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordValidator,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const resendVerificationSchema = z
  .object({
    id: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
  })
  .refine(
    (data) => {
      const val = (data.username || data.email || data.id || '').trim();
      return val.length > 0;
    },
    {
      message: 'Please enter your username or email address',
      path: ['username'],
    }
  )
  .transform((data) => {
    const identifier = (data.username || data.email || data.id || '').trim();
    return {
      ...data,
      id: identifier,
      username: identifier,
    };
  });

export const setContextSchema = z.object({
  tenantUserId: z.string().min(1, 'Organization profile identifier is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordValidator,
});
