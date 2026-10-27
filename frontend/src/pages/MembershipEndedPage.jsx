import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Button } from '../components/Button.jsx';
import { useAuth } from '../auth/useAuth.js';

export function MembershipEndedPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <AuthLayout title="Membership Access Concluded" showAvatar>
      <div style={{ textAlign: 'center', padding: '12px 0 20px 0' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--color-warning-bg)',
            color: 'var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '20px' }}>
          The active subscription or membership period for this organization tenant has ended. Your organization records and project files remain intact, but active collaboration access is currently paused.
        </p>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '32px' }}>
          To extend or renew this organization&apos;s membership, please reach out to your ArchScale representative or email{' '}
          <a href="mailto:hello@archscale.in?subject=Membership%20Renewal%20Inquiry" style={{ color: 'var(--accent-secondary)' }}>
            hello@archscale.in
          </a>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate('/choose-profile')}
          >
            Switch to another profile
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
