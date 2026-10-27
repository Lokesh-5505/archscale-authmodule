import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { apiClient } from '../api/client.js';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/link-problem?reason=missing', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 10) {
      setErrorMessage('Password must be at least 10 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword,
      });

      navigate('/login', {
        state: {
          message: 'Your password has been reset successfully. Please log in with your new password.',
        },
        replace: true,
      });
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'LINK_INVALID' || code === 'TOKEN_EXPIRED') {
        navigate('/link-problem?reason=expired', { replace: true });
      } else {
        setErrorMessage(
          err.response?.data?.error?.message || 'Failed to reset password. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create new password"
      subtitle="Choose a secure password for your ArchScale account"
    >
      {errorMessage && <Alert variant="danger" message={errorMessage} />}

      <form onSubmit={handleSubmit} noValidate>
        <PasswordField
          id="new-password"
          label="New password (min 10 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <Button
          id="reset-password-btn"
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          style={{ marginTop: '12px' }}
        >
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
