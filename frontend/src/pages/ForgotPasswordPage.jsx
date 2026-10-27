import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { FloatingField } from '../components/FloatingField.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { apiClient } from '../api/client.js';

export function ForgotPasswordPage() {
  const [id, setId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!id.trim()) {
      setErrorMessage('Please enter your username or email address.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      await apiClient.post('/auth/forgot-password', { username: id.trim(), id: id.trim() });
      setSubmitted(true);
    } catch {
      // Per spec §9.5: Reply is identical whether or not account exists
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your username or email to receive a password reset link"
    >
      {submitted ? (
        <div className="animate-fade-in" style={{ textAlign: 'center' }}>
          <Alert
            variant="success"
            message="If this account exists, we have sent a password reset link to your registered email address."
          />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Check your inbox (and spam folder). The link will expire in 1 hour.
          </p>
          <Link to="/login">
            <Button variant="secondary" fullWidth>
              Return to login
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {errorMessage && <Alert variant="danger" message={errorMessage} />}

          <FloatingField
            id="forgot-id"
            label="Username or Email"
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            autoComplete="username"
          />

          <Button
            id="forgot-submit-btn"
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            style={{ marginTop: '12px', marginBottom: '20px' }}
          >
            Send reset link
          </Button>

          <div style={{ textAlign: 'center' }}>
            <Link to="/login" style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Remember your password? Sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
