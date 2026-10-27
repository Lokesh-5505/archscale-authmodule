import assert from 'assert';
import { generateToken, hashToken, verifyTokenHash } from '../services/token.service.js';
import { parseDevice } from '../services/device.service.js';
import { getClientIp } from '../services/ip.service.js';
import {
  loginSchema,
  acceptInvitationSchema,
  resetPasswordSchema,
} from '../modules/auth/auth.schemas.js';
import { createInvitationSchema } from '../modules/admin/admin.schemas.js';

console.log('🧪 Starting ArchScale Auth Test Suite...\n');

// 1. Token Service Tests
console.log('1. Testing Token Generation & Hashing...');
const rawToken = generateToken(32);
assert.strictEqual(rawToken.length, 64, 'Raw token should be 64 hex characters (32 bytes)');
const hashed = hashToken(rawToken);
assert.strictEqual(hashed.length, 64, 'SHA-256 hash should be 64 hex characters');
assert.strictEqual(verifyTokenHash(rawToken, hashed), true, 'Token hash verification should pass');
assert.strictEqual(verifyTokenHash('invalid-token', hashed), false, 'Invalid token should fail hash match');
console.log('   ✅ Token generation and constant-time comparison passed.');

// 2. Device Parser Tests
console.log('2. Testing User Agent Device Parsing...');
const chromeAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const parsedDesktop = parseDevice(chromeAgent);
assert.strictEqual(parsedDesktop.deviceType, 'desktop');
assert.ok(parsedDesktop.browser.includes('Chrome'), 'Browser should identify as Chrome');
assert.ok(parsedDesktop.os.includes('Windows'), 'OS should identify as Windows');

const mobileAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const parsedMobile = parseDevice(mobileAgent);
assert.strictEqual(parsedMobile.deviceType, 'mobile');
console.log('   ✅ Device parsing passed.');

// 3. IP Service Tests
console.log('3. Testing IP Extraction behind proxies...');
const mockReqForwarded = {
  headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
};
assert.strictEqual(getClientIp(mockReqForwarded), '203.0.113.195', 'Should extract client IP from X-Forwarded-For');

const mockReqDirect = {
  headers: {},
  ip: '192.168.1.50',
};
assert.strictEqual(getClientIp(mockReqDirect), '192.168.1.50', 'Should extract direct IP fallback');
console.log('   ✅ Client IP extraction passed.');

// 4. Schema Validations
console.log('4. Testing Zod Schemas...');
// Login
assert.strictEqual(loginSchema.safeParse({ id: 'user123', password: 'ValidPassword123' }).success, true);
assert.strictEqual(loginSchema.safeParse({ username: 'user123', password: 'ValidPassword123' }).success, true);
assert.strictEqual(loginSchema.safeParse({ email: 'user@archscale.in', password: 'ValidPassword123' }).success, true);
assert.strictEqual(loginSchema.safeParse({ id: '', password: '' }).success, false);
assert.strictEqual(loginSchema.safeParse({ password: 'ValidPassword123' }).success, false);

// Weak password rejection
const weakPass = acceptInvitationSchema.safeParse({
  token: 'abc',
  userId: 'architect_bob',
  fullName: 'Bob Smith',
  password: 'password123', // in common passwords list
});
assert.strictEqual(weakPass.success, false, 'Should reject common password');

// Valid registration
const validPass = acceptInvitationSchema.safeParse({
  token: 'abc',
  userId: 'architect_bob',
  fullName: 'Bob Smith',
  password: 'StrongArchScale2026!',
});
assert.strictEqual(validPass.success, true, 'Should accept compliant password');

// Admin invitation schema
const futureDate = new Date();
futureDate.setFullYear(futureDate.getFullYear() + 1);
const validInv = createInvitationSchema.safeParse({
  email: 'client@studio.com',
  tenantType: 'studio_owner',
  membershipEndsAt: futureDate.toISOString(),
});
assert.strictEqual(validInv.success, true, 'Should validate invitation schema');

const pastDate = new Date('2020-01-01');
const invalidInv = createInvitationSchema.safeParse({
  email: 'client@studio.com',
  tenantType: 'studio_owner',
  membershipEndsAt: pastDate.toISOString(),
});
assert.strictEqual(invalidInv.success, false, 'Should reject membership end date in the past');
console.log('   ✅ Schema validations and password security checks passed.');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
