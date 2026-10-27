import crypto from 'crypto';

/**
 * Generates a secure cryptographically random token (32 bytes hex)
 */
export function generateToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Computes SHA-256 hash of a string/token
 */
export function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time comparison between raw token and hash
 */
export function verifyTokenHash(token, expectedHash) {
  if (!token || !expectedHash) return false;
  const computedHash = hashToken(token);
  const bufA = Buffer.from(computedHash, 'utf8');
  const bufB = Buffer.from(expectedHash, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
