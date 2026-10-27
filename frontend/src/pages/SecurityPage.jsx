import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { SessionRow } from '../components/SessionRow.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { Modal } from '../components/Modal.jsx';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/useAuth.js';
import './SecurityPage.css';

export function SecurityPage() {
  const { user, logoutAll } = useAuth();
  const navigate = useNavigate();

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [sessionAlert, setSessionAlert] = useState(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwdAlert, setPwdAlert] = useState(null);

  // Modals
  const [showRevokeOthersModal, setShowRevokeOthersModal] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const res = await apiClient.get('/auth/sessions');
      setSessions(res.data.sessions || []);
    } catch (err) {
      console.error('Failed to load active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSingle = async (sessionId) => {
    try {
      setRevokingId(sessionId);
      setSessionAlert(null);
      await apiClient.delete(`/auth/sessions/${sessionId}`);
      setSessionAlert({ variant: 'success', message: 'Device session revoked successfully.' });
      await fetchSessions();
    } catch (err) {
      setSessionAlert({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to revoke device session.',
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    try {
      setRevokingAll(true);
      setSessionAlert(null);
      await apiClient.post('/auth/sessions/revoke-others');
      setShowRevokeOthersModal(false);
      setSessionAlert({ variant: 'success', message: 'All other device sessions have been revoked.' });
      await fetchSessions();
    } catch (err) {
      setSessionAlert({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to revoke other sessions.',
      });
    } finally {
      setRevokingAll(false);
    }
  };

  const handleLogoutAll = async () => {
    try {
      setLoggingOutAll(true);
      setShowLogoutAllModal(false);
      await logoutAll();
      navigate('/login');
    } catch (err) {
      setSessionAlert({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to log out all devices.',
      });
      setLoggingOutAll(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdAlert(null);

    if (newPassword.length < 10) {
      setPwdAlert({ variant: 'danger', message: 'New password must be at least 10 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdAlert({ variant: 'danger', message: 'New passwords do not match. Please re-enter.' });
      return;
    }

    try {
      setChangingPassword(true);
      const res = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      setPwdAlert({
        variant: 'success',
        message: res.data.message || 'Password updated successfully! Other devices have been logged out.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await fetchSessions();
    } catch (err) {
      setPwdAlert({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to update password.',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <AuthLayout
      wide
      showAvatar
      title="Account & Security"
      subtitle={`Manage active device sessions and security credentials for @${user?.userId}`}
    >
      {/* Active Device Sessions */}
      <section className="security-section">
        <div className="security-section-header">
          <h2 className="security-section-title">Signed-in Devices</h2>
          <p className="security-section-desc">
            Devices that are currently logged into your ArchScale account. If you spot an unrecognized device, log it out immediately.
          </p>
        </div>

        {sessionAlert && <Alert variant={sessionAlert.variant} message={sessionAlert.message} />}

        {loadingSessions ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div>
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onRevoke={handleRevokeSingle}
                isRevoking={revokingId === s.id}
              />
            ))}

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {otherSessionsCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRevokeOthersModal(true)}
                >
                  Log out of all other devices ({otherSessionsCount})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogoutAllModal(true)}
                style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Log out of all devices
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="security-section-divider" />

      {/* Change Password */}
      <section className="security-section">
        <div className="security-section-header">
          <h2 className="security-section-title">Change Password</h2>
          <p className="security-section-desc">
            Updating your password will automatically log out all your other active sessions across any browser or device.
          </p>
        </div>

        {pwdAlert && <Alert variant={pwdAlert.variant} message={pwdAlert.message} />}

        <form onSubmit={handleChangePassword} style={{ maxWidth: '440px' }} noValidate>
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <PasswordField
            id="sec-new-password"
            label="New password (min 10 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <PasswordField
            id="sec-confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <Button
            type="submit"
            variant="primary"
            loading={changingPassword}
            style={{ marginTop: '8px' }}
          >
            Update password
          </Button>
        </form>
      </section>

      {/* Confirmation Modal for Revoking Other Devices */}
      <Modal
        isOpen={showRevokeOthersModal}
        title="Log out other devices?"
        onClose={() => setShowRevokeOthersModal(false)}
        onConfirm={handleRevokeOthers}
        confirmText="Log out others"
        confirmVariant="danger"
        loading={revokingAll}
      >
        This will terminate all other {otherSessionsCount} active session(s). Those devices will need to sign in again to access ArchScale.
      </Modal>

      {/* Confirmation Modal for Logging Out of All Devices */}
      <Modal
        isOpen={showLogoutAllModal}
        title="Log out of all devices?"
        onClose={() => setShowLogoutAllModal(false)}
        onConfirm={handleLogoutAll}
        confirmText="Log out of all devices"
        confirmVariant="danger"
        loading={loggingOutAll}
      >
        This will terminate all {sessions.length} active session(s) across all your devices, including this current device. You will be redirected to the sign-in screen.
      </Modal>
    </AuthLayout>
  );
}
