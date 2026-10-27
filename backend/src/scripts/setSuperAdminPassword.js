import { connectDB, disconnectDB } from 'file:///c:/Users/ramlo/archscale-authmodule/backend/src/config/db.js';
import { User } from 'file:///c:/Users/ramlo/archscale-authmodule/backend/src/models/index.js';
import { supabaseAdmin } from 'file:///c:/Users/ramlo/archscale-authmodule/backend/src/config/supabase.js';

async function setPassword(email, newPassword) {
  await connectDB();
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User ${email} not found in MongoDB`);
    process.exit(1);
  }

  // Ensure username and usernameLower are set in MongoDB
  user.username = user.userId;
  user.usernameLower = user.userId.toLowerCase();
  await user.save();
  console.log(`✅ Updated MongoDB record for ${email}: username=${user.username}`);

  // Set password in Supabase
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    user.supabaseUserId,
    { password: newPassword }
  );

  if (error) {
    console.error('❌ Supabase password update failed:', error.message);
  } else {
    console.log(`🎉 Supabase password set successfully for ${email} (UUID: ${data.user.id})`);
  }

  await disconnectDB();
}

const targetEmail = process.argv[2] || 'superadmin@archscale.in';
const password = process.argv[3] || 'SuperAdmin@1234!';
setPassword(targetEmail, password).catch(console.error);
