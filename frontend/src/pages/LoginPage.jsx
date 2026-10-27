import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { FloatingField } from '../components/FloatingField.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { Toggle } from '../components/Toggle.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { useAuth } from '../auth/useAuth.js';
import './LoginPage.css';

export function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [shake, setShake] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const successNotice = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!id.trim() || !password) {
      setErrorMessage('Please enter your username or email and password.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    try {
      setLoading(true);
      const data = await login({ username: id.trim(), id: id.trim(), password, rememberMe });

      // Role and context routing rules
      if (data.user.platformRole === 'super_admin') {
        navigate('/admin/invitations');
      } else if (data.user.platformRole === 'admin') {
        navigate('/security');
      } else {
        // Subscribers: Check contexts per TDD §5.6 & §18.4
        const activeContexts = (data.contexts || []).filter((c) => c.isActive);
        if (activeContexts.length === 1) {
          // Exactly 1 active profile -> auto-enter directly to workspace
          navigate('/security');
        } else if (activeContexts.length > 1) {
          // Multiple profiles -> Choose Profile screen
          navigate('/choose-profile');
        } else {
          // 0 active profiles -> Membership ended screen
          navigate('/membership-ended');
        }
      }
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const message =
        err.response?.data?.error?.message ||
        (!err.response
          ? 'Cannot connect to backend server. Please make sure the backend is running on port 5000.'
          : 'Username, email, or password is incorrect. Please try again.');

      setErrorMessage(message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome to ArchScale"
      subtitle="Sign in to your architectural workspace"
    >
      {successNotice && <Alert variant="success" message={successNotice} />}
      {errorMessage && (
        <div className={shake ? 'animate-shake' : ''}>
          <Alert variant="danger" message={errorMessage} />
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Username or Email field */}
        <FloatingField
          id="login-id"
          label="Username or Email"
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          autoComplete="username"
          required
        />

        {/* Password field */}
        <PasswordField
          id="login-password"
          label="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {/* Keep me signed in & Forgot Password */}
        <div className="login-help-row">
          <Toggle
            id="remember-me-toggle"
            label="Keep me signed in"
            checked={rememberMe}
            onChange={setRememberMe}
          />
          <Link to="/forgot-password" className="forgot-password-link">
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <Button
          id="login-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
        >
          Continue
        </Button>
      </form>

      {/* Invite Only Notice */}
      <div className="invite-only-box">
        ArchScale is invite-only. Ask your ArchScale contact, or write to{' '}
        <a href="mailto:hello@archscale.in?subject=ArchScale%20Invitation%20Inquiry">
          hello@archscale.in
        </a>
      </div>
    </AuthLayout>
  );
}
