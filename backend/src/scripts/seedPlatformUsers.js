import crypto from 'crypto';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { User, AuthToken, AuthEvent } from '../models/index.js';
import { PLATFORM_ROLES } from '../config/constants.js';
import { generateToken, hashToken } from '../services/token.service.js';
import { mailService } from '../services/mail.service.js';

async function seedUser({ email, role, fullName, defaultUserId }) {
  console.log(`\n🌱 Processing seed account: ${role} (${email})...`);

  // Check if user already exists in MongoDB
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    console.log(`ℹ️  User with email ${email} already exists (ID: ${existingUser.userId}). Skipping creation.`);
    return;
  }

  let supabaseUserId;

  // Check if real Supabase keys configured
  if (!env.SUPABASE_URL.includes('placeholder')) {
    try {
      const { data: suUser, error: suError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (suError) {
        // If user already exists in Supabase, fetch their UUID
        if (suError.message?.includes('already been registered') || suError.status === 422) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const found = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (found) {
            supabaseUserId = found.id;
          } else {
            throw suError;
          }
        } else {
          throw suError;
        }
      } else {
        supabaseUserId = suUser.user.id;
      }
    } catch (err) {
      console.warn(`⚠️ Supabase user creation warning (${err.message}). Using local fallback UUID.`);
      supabaseUserId = crypto.randomUUID();
    }
  } else {
    supabaseUserId = crypto.randomUUID();
  }

  // Create User in MongoDB
  const user = await User.create({
    supabaseUserId,
    userId: defaultUserId,
    username: defaultUserId,
    email: email.toLowerCase(),
    fullName,
    platformRole: role,
    status: 'active',
    emailVerifiedAt: new Date(),
  });

  console.log(`✅ Created MongoDB user record: ${user.fullName} (@${user.userId})`);

  // Create set-password token (1 hour / 72 hours initial grace for seed)
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  await AuthToken.create({
    userId: user._id,
    purpose: 'reset_password',
    tokenHash,
    expiresAt,
  });

  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  // Audit event
  await AuthEvent.create({
    type: 'seed_user_created',
    userId: user._id,
    meta: { email, role, userId: user.userId },
  });

  // Send email / print link to console
  await mailService.sendResetPassword({
    to: email,
    link: resetLink,
    userName: fullName,
  });

  console.log(`🔗 Set-password link for ${role} (${email}):`);
  console.log(`   ${resetLink}`);
}

async function runSeed() {
  try {
    await connectDB();

    console.log('🚀 Seeding initial ArchScale platform accounts...');

    // 1. Super Admin
    await seedUser({
      email: env.SEED_SUPER_ADMIN_EMAIL,
      role: PLATFORM_ROLES.SUPER_ADMIN,
      fullName: 'ArchScale Super Admin',
      defaultUserId: 'superadmin',
    });

    console.log('\n🎉 Super Admin seeding complete.\n');
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

runSeed();
