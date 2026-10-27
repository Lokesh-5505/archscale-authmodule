import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { FloatingField } from '../components/FloatingField.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { apiClient } from '../api/client.js';

const tenantLabels = {
  admin: 'Admin',
  manager: 'Manager / Coordinator',
  executive: 'Executive',
  project_owner: 'Manager / Coordinator',
  studio_owner: 'Admin',
  vendor_owner: 'Executive',
};

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [inviteData, setInviteData] = useState(null);
  const [checkingToken, setCheckingToken] = useState(true);

  // Form fields
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/link-problem?reason=missing', { replace: true });
      return;
    }

    async function verifyInvite() {
      try {
        setCheckingToken(true);
        const res = await apiClient.post('/auth/invitations/lookup', { token });
        setInviteData(res.data);
        if (res.data.prefill?.fullName) {
          setFullName(res.data.prefill.fullName);
        }
        if (res.data.organizationName) {
          setOrganizationName(res.data.organizationName);
        }
      } catch (err) {
        const code = err.response?.data?.error?.code || 'LINK_INVALID';
        navigate(`/link-problem?reason=${code.toLowerCase()}`, { replace: true });
      } finally {
        setCheckingToken(false);
      }
    }

    verifyInvite();
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!userId.trim()) {
      setErrorMessage('Please choose a username for signing in.');
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (password.length < 10) {
      setErrorMessage('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/auth/invitations/accept', {
        token,
        userId: userId.trim(),
        username: userId.trim(),
        fullName: fullName.trim(),
        password,
        organizationName: organizationName.trim() || undefined,
      });

      navigate('/login', {
        state: {
          message: 'Account registered successfully! You may now sign in with your username or email and password.',
        },
        replace: true,
      });
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error?.message || 'Failed to complete registration. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingToken) {
    return (
      <AuthLayout title="Verifying invitation..." subtitle="Please wait while we validate your invite link">
        <div style={{ textAlign: 'center', padding: '36px 0' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
        </div>
      </AuthLayout>
    );
  }

  const roleName = tenantLabels[inviteData?.tenantType] || 'Collaborator';
  const orgPrefilled = !!inviteData?.organizationName;

  return (
    <AuthLayout
      title="Join ArchScale"
      subtitle={
        inviteData?.organizationName
          ? `You've been invited to join ${inviteData.organizationName} as a ${roleName}`
          : `You've been invited as a ${roleName}`
      }
    >
      {errorMessage && <Alert variant="danger" message={errorMessage} />}

      <form onSubmit={handleSubmit} noValidate>
        {/* Email (Read-Only) */}
        <FloatingField
          id="invite-email"
          label="Invited Email"
          type="email"
          value={inviteData?.email || ''}
          readOnly
          disabled
        />

        {/* Username */}
        <FloatingField
          id="register-userid"
          label="Choose your Username (e.g. john_doe)"
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
          autoComplete="username"
        />

        {/* Full Name */}
        <FloatingField
          id="register-fullname"
          label="Your Full Name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
        />

        {/* Organization Name (if not prefilled) */}
        {!orgPrefilled && (
          <FloatingField
            id="register-org"
            label="Organization or Studio Name"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        )}

        {/* Password */}
        <PasswordField
          id="register-password"
          label="Create password (min 10 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        {/* Confirm Password */}
        <PasswordField
          id="register-confirm-password"
          label="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <Button
          id="accept-invite-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          style={{ marginTop: '12px' }}
        >
          Create account & activate
        </Button>
      </form>
    </AuthLayout>
  );
}
