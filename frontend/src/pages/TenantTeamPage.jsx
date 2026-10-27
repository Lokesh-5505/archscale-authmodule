import React, { useState, useEffect, useCallback } from 'react';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Button } from '../components/Button.jsx';
import { FloatingField } from '../components/FloatingField.jsx';
import { Alert } from '../components/Alert.jsx';
import { useAuth } from '../auth/useAuth.js';
import { apiClient } from '../api/client.js';
import './TenantTeamPage.css';

export function TenantTeamPage() {
  const { user, activeContext } = useAuth();
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertState, setAlertState] = useState(null);
  const [actionId, setActionId] = useState(null);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState('executive');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  const isAdmin =
    activeContext?.role === 'admin' ||
    activeContext?.rawRole === 'owner' ||
    activeContext?.rawRole === 'studio_owner' ||
    user?.platformRole === 'super_admin';

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tenant/subscribers');
      setSubscribers(res.data.subscribers || []);
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to load tenant subscribers',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleToggleStatus = async (sub) => {
    const nextStatus = sub.status === 'active' ? 'inactive' : 'active';
    const confirmMsg =
      nextStatus === 'inactive'
        ? `Are you sure you want to deactivate ${sub.user?.fullName || sub.user?.email || 'this subscriber'}? They will be unable to access this workspace.`
        : `Reactivate access for ${sub.user?.fullName || sub.user?.email || 'this subscriber'}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionId(sub.id);
      setAlertState(null);
      const res = await apiClient.patch(`/tenant/subscribers/${sub.id}/status`, {
        status: nextStatus,
      });

      setAlertState({
        variant: 'success',
        message: res.data.message || `Subscriber ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`,
      });
      await fetchSubscribers();
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to update subscriber status',
      });
    } finally {
      setActionId(null);
    }
  };

  const handleRoleChange = async (subId, newRole) => {
    try {
      setActionId(subId);
      setAlertState(null);
      await apiClient.patch(`/tenant/subscribers/${subId}/role`, { role: newRole });
      setAlertState({
        variant: 'success',
        message: 'Subscriber role updated successfully.',
      });
      await fetchSubscribers();
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to update subscriber role',
      });
    } finally {
      setActionId(null);
    }
  };

  const handleRemoveSubscriber = async (sub) => {
    if (!window.confirm(`Are you sure you want to remove ${sub.user?.fullName || sub.user?.email} from this workspace?`)) {
      return;
    }

    try {
      setActionId(sub.id);
      setAlertState(null);
      await apiClient.delete(`/tenant/subscribers/${sub.id}`);
      setAlertState({
        variant: 'info',
        message: 'Subscriber removed from workspace.',
      });
      await fetchSubscribers();
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to remove subscriber',
      });
    } finally {
      setActionId(null);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviting(true);
      setAlertState(null);
      const res = await apiClient.post('/tenant/subscribers/invite', {
        email: inviteEmail.trim(),
        fullName: inviteFullName.trim() || undefined,
        role: inviteRole,
      });

      setInviteResult(res.data);
      setAlertState({
        variant: 'success',
        message: res.data.message || 'Invitation created successfully!',
      });

      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('executive');
      setShowInviteModal(false);
      await fetchSubscribers();
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to send workspace invitation',
      });
    } finally {
      setInviting(false);
    }
  };

  return (
    <AuthLayout
      wide
      showAvatar
      title={activeContext?.organizationName ? `${activeContext.organizationName} — Team Members` : 'Workspace Team'}
      subtitle="Manage team subscriber access and permissions within this tenant workspace"
    >
      <div className="tenant-team-header">
        <div>
          <h2 className="tenant-team-title">Workspace Members</h2>
          <p className="tenant-team-subtitle">
            Current role in this workspace: <strong>{activeContext?.role === 'admin' ? 'Admin (Full Management)' : activeContext?.role === 'manager' ? 'Manager / Coordinator (Multiple Access)' : 'Executive (Limited Access)'}</strong>
          </p>
        </div>

        {isAdmin && (
          <Button
            id="invite-member-btn"
            variant="primary"
            size="md"
            onClick={() => setShowInviteModal(true)}
          >
            + Invite Team Member
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="team-access-banner animate-fade-in">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span>
            You have operational view access to this workspace team roster. Only a tenant <strong>Admin</strong> can activate, deactivate, or invite members.
          </span>
        </div>
      )}

      {alertState && (
        <div style={{ marginBottom: '24px' }}>
          <Alert variant={alertState.variant} message={alertState.message} />
        </div>
      )}

      {/* Members Table */}
      <div className="team-table-wrapper">
        <table className="team-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined Date</th>
              {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '32px' }}>
                  <div className="spinner" />
                </td>
              </tr>
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No subscribers found for this workspace.
                </td>
              </tr>
            ) : (
              subscribers.map((sub) => {
                const isCurrentSelf = sub.user?.id === user?.id;
                const isSubAdmin = sub.role === 'admin' || sub.role === 'owner' || sub.role === 'studio_owner';
                return (
                  <tr key={sub.id}>
                    <td>
                      <div className="team-user-cell">
                        <div className="team-user-avatar">
                          {sub.user?.initials || 'AS'}
                        </div>
                        <div>
                          <div className="team-user-name">
                            {sub.user?.fullName || sub.user?.userId || 'Unnamed User'}{' '}
                            {isCurrentSelf && <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>(You)</span>}
                          </div>
                          <div className="team-user-email">{sub.user?.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isSubAdmin ? (
                        <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                          </svg>
                          Admin (Primary)
                        </span>
                      ) : isAdmin ? (
                        <select
                          className="team-role-select"
                          value={sub.role}
                          onChange={(e) => handleRoleChange(sub.id, e.target.value)}
                          disabled={actionId === sub.id}
                        >
                          <option value="manager">Manager / Coordinator</option>
                          <option value="executive">Executive</option>
                        </select>
                      ) : (
                        <span className="badge badge-secondary">
                          {sub.role === 'manager' ? 'Manager / Coordinator' : 'Executive'}
                        </span>
                      )}
                    </td>
                    <td>
                      {sub.status === 'active' ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Inactive</span>
                      )}
                    </td>
                    <td>{new Date(sub.createdAt).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td>
                        <div className="team-actions">
                          {isSubAdmin ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                              Primary Admin
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={`btn-toggle-status ${sub.status === 'active' ? 'deactivate' : 'activate'}`}
                                onClick={() => handleToggleStatus(sub)}
                                disabled={actionId === sub.id}
                              >
                                {sub.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>

                              {!isCurrentSelf && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--color-danger)' }}
                                  onClick={() => handleRemoveSubscriber(sub)}
                                  disabled={actionId === sub.id}
                                  title="Remove from workspace"
                                >
                                  Remove
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="team-modal" onClick={(e) => e.stopPropagation()}>
            <div className="team-modal-header">
              <h3 className="team-modal-title">Invite Member to Workspace</h3>
              <button
                type="button"
                className="team-modal-close"
                onClick={() => setShowInviteModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendInvite}>
              <div style={{ marginBottom: '16px' }}>
                <FloatingField
                  id="invite-member-email"
                  label="Email Address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <FloatingField
                  id="invite-member-name"
                  label="Full Name (Optional)"
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Assign Role
                </label>
                <select
                  className="admin-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-primary)' }}
                >
                  <option value="executive">Executive (Limited Access)</option>
                  <option value="manager">Manager / Coordinator (Multiple Access)</option>
                </select>
                <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                  Each workspace strictly has one Admin. Additional subscribers can be invited as Manager or Executive.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Button
                  variant="ghost"
                  size="md"
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  loading={inviting}
                >
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
