import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Button } from '../components/Button.jsx';

export function LinkProblemPage() {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');

  let title = 'Link no longer valid';
  let description =
    'This link is invalid, expired, or has already been used to configure an account.';

  if (reason === 'token_expired' || reason === 'expired') {
    title = 'This link has expired';
    description =
      'For security reasons, invitation and password reset links are time-limited. This link has passed its expiration window.';
  } else if (reason === 'missing') {
    title = 'Missing security token';
    description =
      'No verification token was provided in your request. Please open the complete link sent to your email.';
  }

  return (
    <AuthLayout title={title}>
      <div style={{ textAlign: 'center', padding: '12px 0 20px 0' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
          {description}
        </p>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '32px' }}>
          If you need a new invitation or assistance, please contact your ArchScale administrator or email{' '}
          <a href="mailto:hello@archscale.in?subject=Expired%20Link%20Inquiry" style={{ color: 'var(--accent-secondary)' }}>
            hello@archscale.in
          </a>.
        </p>

        <Link to="/login">
          <Button variant="primary" fullWidth size="lg">
            Return to sign in
          </Button>
        </Link>
      </div>
    </AuthLayout>
  );
}
