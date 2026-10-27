import { Session, LoginAttempt } from '../models/index.js';

/**
 * Background maintenance service to revoke expired sessions and purge old data
 */
export async function runSessionCleanup() {
  try {
    const now = new Date();

    // 1. Mark expired sessions as revoked
    const expiredResult = await Session.updateMany(
      {
        revokedAt: null,
        expiresAt: { $lt: now },
      },
      {
        $set: {
          revokedAt: now,
          revokedReason: 'expired',
        },
      }
    );

    if (expiredResult.modifiedCount > 0) {
      console.log(`🧹 Marked ${expiredResult.modifiedCount} expired sessions as revoked.`);
    }

    // 2. Permanently delete sessions revoked > 90 days ago
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const purgedResult = await Session.deleteMany({
      revokedAt: { $lt: ninetyDaysAgo },
    });

    if (purgedResult.deletedCount > 0) {
      console.log(`🗑️ Purged ${purgedResult.deletedCount} historical sessions (>90 days old).`);
    }
  } catch (err) {
    console.error('❌ Session cleanup job error:', err.message);
  }
}

/**
 * Initializes cleanup timer (every 24 hours, plus immediate initial run)
 */
export function startSessionCleanupScheduler() {
  // Initial run after 1 minute of server uptime
  setTimeout(() => {
    runSessionCleanup();
  }, 60 * 1000);

  // Recurring 24-hour interval
  setInterval(() => {
    runSessionCleanup();
  }, 24 * 60 * 60 * 1000);
}
