import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { ProfileCard } from '../components/ProfileCard.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { useAuth } from '../auth/useAuth.js';
import './ChooseProfilePage.css';

export function ChooseProfilePage() {
  const { user, contexts, switchContext, logout, refreshContexts } = useAuth();
  const [selectedContext, setSelectedContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const fetchedRef = useRef(false);

  useEffect(() => {
    // Redirect super admin away from profile selector
    if (user?.platformRole === 'super_admin') {
      navigate('/admin/invitations', { replace: true });
      return;
    }

    if (!fetchedRef.current) {
      fetchedRef.current = true;
      refreshContexts();
    }
  }, [user, navigate, refreshContexts]);

  // Auto-redirect per TDD §5.6 & §18.4:
  // - If exactly 1 active context: continue automatically to workspace
  // - If 0 active contexts: redirect to membership-ended
  useEffect(() => {
    if (!contexts || contexts.length === 0) return;

    const active = contexts.filter((c) => c.isActive);
    if (active.length === 0) {
      navigate('/membership-ended', { replace: true });
    } else if (active.length === 1 && !selectedContext) {
      setSelectedContext(active[0]);
    } else if (active.length > 1 && !selectedContext) {
      const lastUsed = active.find((c) => c.isLastUsed);
      setSelectedContext(lastUsed || active[0]);
    }
  }, [contexts, selectedContext, navigate]);

  const handleContinue = async () => {
    if (!selectedContext) return;

    try {
      setLoading(true);
      setErrorMessage('');
      await switchContext(selectedContext.tenantUserId);
      navigate('/security'); // Or main workspace dashboard when integrated
    } catch (err) {
      if (err.response?.data?.error?.code === 'MEMBERSHIP_INACTIVE') {
        navigate('/membership-ended');
      } else {
        setErrorMessage(
          err.response?.data?.error?.message || 'Failed to switch profile context.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseAnotherId = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <AuthLayout wide showAvatar={false}>
      <div className="choose-profile-header">
        <div className="choose-profile-avatar-wrapper">
          <Avatar size="lg" interactive={false} />
        </div>
        <h1 className="choose-profile-title">Who are you today?</h1>
        <p className="choose-profile-subtitle">
          Signed in as <strong>{user?.fullName || user?.userId}</strong>. You can switch any time from your avatar menu.
        </p>
      </div>

      {errorMessage && <Alert variant="danger" message={errorMessage} />}

      {/* Profile Cards Grid */}
      <div className="choose-profile-grid">
        {contexts && contexts.length > 0 ? (
          contexts.map((ctx) => (
            <ProfileCard
              key={ctx.tenantUserId}
              context={ctx}
              selected={selectedContext?.tenantUserId === ctx.tenantUserId}
              onSelect={setSelectedContext}
            />
          ))
        ) : (
          <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '32px 0', color: 'var(--text-muted)' }}>
            No organization memberships linked to this account yet.
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="choose-profile-footer">
        <Button
          id="pick-profile-btn"
          variant="primary"
          size="lg"
          onClick={handleContinue}
          disabled={!selectedContext || !selectedContext.isActive}
          loading={loading}
          style={{ minWidth: '220px' }}
        >
          {selectedContext ? 'Pick one to continue' : 'Select a profile'}
        </Button>

        <button
          type="button"
          className="use-another-id-btn"
          onClick={handleUseAnotherId}
        >
          Sign in with another account
        </button>
      </div>
    </AuthLayout>
  );
}
