import React, { useState, useEffect, useCallback } from 'react';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { FloatingField } from '../components/FloatingField.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { apiClient } from '../api/client.js';
import './AdminInvitationsPage.css';

const roleOptions = [
  { value: 'admin', label: 'Admin (Tenant Administrator)' },
  { value: 'manager', label: 'Manager / Coordinator' },
  { value: 'executive', label: 'Executive' },
];

export function AdminInvitationsPage() {
  const [activeTab, setActiveTab] = useState('invite'); // 'invite' | 'manual' | 'tenants'
  const [invitations, setInvitations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form fields
  const [email, setEmail] = useState('');
  const [tenantRole, setTenantRole] = useState('admin');
  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState('');
  const [membershipEndsAt, setMembershipEndsAt] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });

  const [submitting, setSubmitting] = useState(false);
  const [alertState, setAlertState] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Tenants Directory State (Super Admin)
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [activeTenantSubscribers, setActiveTenantSubscribers] = useState(null); // tenant object
  const [subscribersList, setSubscribersList] = useState([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  const fetchInvitations = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await apiClient.get('/admin/invitations');
      setInvitations(res.data.invitations || []);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      setLoadingTenants(true);
      const res = await apiClient.get('/admin/tenants');
      setTenants(res.data.tenants || []);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'tenants') {
      fetchTenants();
    } else {
      fetchInvitations();
    }
  }, [activeTab, fetchInvitations, fetchTenants]);

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlertState(null);

    if (!email.trim()) {
      setAlertState({ variant: 'danger', message: 'Please enter a valid invitee email address.' });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        email: email.trim(),
        role: tenantRole,
        tenantType: tenantRole,
        organizationName: organizationName.trim() || undefined,
        membershipEndsAt: new Date(membershipEndsAt).toISOString(),
        mode: activeTab,
        ...(activeTab === 'manual' && {
          prefill: {
            fullName: fullName.trim() || undefined,
            organizationName: organizationName.trim() || undefined,
          },
        }),
      };

      const res = await apiClient.post('/admin/invitations', payload);
      const emailDelivery = res.data.emailDelivery;
      const inviteLink = res.data.inviteLink;

      if (emailDelivery?.sent) {
        setAlertState({
          variant: 'success',
          message: `Invitation successfully sent to ${email} via ${emailDelivery.provider.toUpperCase()}!`,
          link: inviteLink,
        });
      } else if (emailDelivery?.error) {
        setAlertState({
          variant: 'warning',
          message: `Invitation created, but email could not be delivered to ${email} (${emailDelivery.error}). You can copy and share the link manually below.`,
          link: inviteLink,
        });
      } else {
        setAlertState({
          variant: 'success',
          message: `Invitation successfully created for ${email}!`,
          link: inviteLink,
        });
      }

      setEmail('');
      setOrganizationName('');
      setFullName('');
      await fetchInvitations();
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to dispatch invitation.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (id, autoCopy = false) => {
    try {
      setActionId(id);
      const res = await apiClient.post(`/admin/invitations/${id}/resend`);
      const emailDelivery = res.data.emailDelivery;
      const inviteLink = res.data.inviteLink;

      if (autoCopy && inviteLink) {
        await copyToClipboard(inviteLink, id);
      }

      setAlertState({
        variant: 'success',
        message: res.data.message || 'Invitation resent successfully!',
        link: inviteLink,
      });

      await fetchInvitations();
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to resend invitation.',
      });
    } finally {
      setActionId(null);
    }
  };

  const handleCopyLink = async (inv) => {
    if (inv.inviteLink) {
      await copyToClipboard(inv.inviteLink, inv.id);
    } else {
      await handleResend(inv.id, true);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this invitation?')) return;
    try {
      setActionId(id);
      await apiClient.post(`/admin/invitations/${id}/cancel`);
      setAlertState({
        variant: 'info',
        message: 'Invitation cancelled.',
      });
      await fetchInvitations();
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to cancel invitation.',
      });
    } finally {
      setActionId(null);
    }
  };

  // Super Admin: Toggle Tenant Status
  const handleToggleTenantStatus = async (tenant) => {
    const nextStatus = tenant.status === 'active' ? 'deactivated' : 'active';
    const confirmMsg =
      nextStatus === 'deactivated'
        ? `Are you sure you want to DEACTIVATE "${tenant.name}"? All subscribers and administrators of this tenant will be blocked from accessing this workspace.`
        : `Reactivate workspace "${tenant.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionId(tenant.id);
      setAlertState(null);
      const res = await apiClient.patch(`/admin/tenants/${tenant.id}/status`, {
        status: nextStatus,
      });

      setAlertState({
        variant: 'success',
        message: res.data.message || `Tenant workspace ${nextStatus}.`,
      });
      await fetchTenants();
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to update tenant status',
      });
    } finally {
      setActionId(null);
    }
  };

  // Super Admin: View Tenant Subscribers
  const handleOpenSubscribersDrawer = async (tenant) => {
    setActiveTenantSubscribers(tenant);
    try {
      setLoadingSubscribers(true);
      const res = await apiClient.get(`/admin/tenants/${tenant.id}/subscribers`);
      setSubscribersList(res.data.subscribers || []);
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to load subscribers for tenant',
      });
    } finally {
      setLoadingSubscribers(false);
    }
  };

  // Super Admin: Toggle Subscriber Status in any tenant
  const handleToggleSubscriberStatus = async (sub) => {
    const nextStatus = sub.status === 'active' ? 'inactive' : 'active';
    const confirmMsg =
      nextStatus === 'inactive'
        ? `Deactivate subscriber ${sub.user?.fullName || sub.user?.email}?`
        : `Activate subscriber ${sub.user?.fullName || sub.user?.email}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionId(sub.id);
      await apiClient.patch(`/admin/subscribers/${sub.id}/status`, {
        status: nextStatus,
      });

      // Refresh drawer
      const res = await apiClient.get(`/admin/tenants/${activeTenantSubscribers.id}/subscribers`);
      setSubscribersList(res.data.subscribers || []);
    } catch (err) {
      setAlertState({
        variant: 'danger',
        message: err.response?.data?.error?.message || 'Failed to update subscriber status',
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <AuthLayout
      wide
      showAvatar
      title="Platform Super Admin Portal"
      subtitle="Universal platform governance: Manage tenant workspaces, subscriber access, and invitations"
    >
      {/* Tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'invite' ? 'active' : ''}`}
          onClick={() => setActiveTab('invite')}
        >
          Send Invite
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          Manual Registration
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'tenants' ? 'active' : ''}`}
          onClick={() => setActiveTab('tenants')}
        >
          Tenants Directory
        </button>
      </div>

      {alertState && (
        <div style={{ marginBottom: '24px' }}>
          <Alert variant={alertState.variant} message={alertState.message} />
          {alertState.link && (
            <div className="invite-link-banner animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 16px' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Direct access link generated for invitee
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(alertState.link, 'banner')}
              >
                {copiedId === 'banner' ? '✓ Link Copied to Clipboard' : 'Copy Invitation Link'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TENANTS DIRECTORY TAB */}
      {activeTab === 'tenants' ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Platform Tenants</h3>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Universal access control: Activate or deactivate any tenant workspace
            </span>
          </div>

          <div className="invitations-table-wrapper">
            <table className="invitations-table">
              <thead>
                <tr>
                  <th>Workspace Name</th>
                  <th>Organization</th>
                  <th>Subscribers</th>
                  <th>Tenant Admin</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingTenants ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                      <div className="spinner" />
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No tenants provisioned on the platform yet.
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.name}</strong></td>
                      <td>{t.organization?.name || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.8125rem', color: 'var(--accent-primary)' }}
                          onClick={() => handleOpenSubscribersDrawer(t)}
                        >
                          {t.subscriberCount} members (View)
                        </button>
                      </td>
                      <td>
                        {t.admin ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{t.admin.fullName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.admin.email}</div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {t.status === 'active' ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-danger">Deactivated</span>
                        )}
                      </td>
                      <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${t.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => handleToggleTenantStatus(t)}
                            disabled={actionId === t.id}
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              background: t.status === 'active' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: t.status === 'active' ? 'var(--color-danger)' : 'var(--color-success)',
                              border: `1px solid ${t.status === 'active' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                            }}
                          >
                            {t.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenSubscribersDrawer(t)}
                          >
                            Manage Members
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* INVITATIONS TABS */
        <>
          <form onSubmit={handleSubmit} style={{ marginBottom: '40px' }} noValidate>
            <div className="admin-form-grid">
              <FloatingField
                id="inv-email"
                label="Invitee Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="admin-select-wrapper">
                <label htmlFor="inv-tenant-type" className="admin-select-label">
                  Subscriber Role
                </label>
                <select
                  id="inv-tenant-type"
                  className="admin-select"
                  value={tenantRole}
                  onChange={(e) => setTenantRole(e.target.value)}
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ background: '#141926' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-grid">
              <FloatingField
                id="inv-org"
                label="Organization / Workspace Name"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
              />

              <FloatingField
                id="inv-ends-at"
                label="Access Valid Until"
                type="date"
                value={membershipEndsAt}
                onChange={(e) => setMembershipEndsAt(e.target.value)}
                required
              />
            </div>

            {activeTab === 'manual' && (
              <div className="admin-form-grid">
                <FloatingField
                  id="inv-prefill-fullname"
                  label="Subscriber Full Name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <Button
              id="send-invite-btn"
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
            >
              {activeTab === 'invite' ? 'Send Invitation' : 'Register & Dispatch Link'}
            </Button>
          </form>

          {/* Invitations History Table */}
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Sent Invitations</h3>
          <div className="invitations-table-wrapper">
            <table className="invitations-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Assigned Role</th>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Expires At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>
                      <div className="spinner" />
                    </td>
                  </tr>
                ) : invitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No invitations dispatched yet.
                    </td>
                  </tr>
                ) : (
                  invitations.map((inv) => {
                    let roleDisplay = inv.tenantType;
                    if (roleDisplay === 'studio_owner' || roleDisplay === 'admin') roleDisplay = 'Admin';
                    else if (roleDisplay === 'project_owner' || roleDisplay === 'manager') roleDisplay = 'Manager / Coordinator';
                    else if (roleDisplay === 'vendor_owner' || roleDisplay === 'executive') roleDisplay = 'Executive';

                    return (
                      <tr key={inv.id}>
                        <td><strong>{inv.email}</strong></td>
                        <td><span className="badge badge-secondary">{roleDisplay}</span></td>
                        <td>{inv.organizationName || '—'}</td>
                        <td>
                          {inv.status === 'pending' && <span className="badge badge-warning">Pending</span>}
                          {inv.status === 'accepted' && <span className="badge badge-success">Accepted</span>}
                          {inv.status === 'expired' && <span className="badge badge-danger">Expired</span>}
                          {inv.status === 'cancelled' && <span className="badge badge-secondary">Cancelled</span>}
                        </td>
                        <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          {inv.status === 'pending' && (
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyLink(inv)}
                                title="Copy invitation link"
                                style={{ color: copiedId === inv.id ? 'var(--color-success)' : undefined }}
                              >
                                {copiedId === inv.id ? '✓ Copied' : 'Copy Link'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResend(inv.id)}
                                loading={actionId === inv.id}
                              >
                                Resend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(inv.id)}
                                loading={actionId === inv.id}
                                style={{ color: 'var(--color-danger)' }}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Super Admin: Tenant Subscribers Modal / Drawer */}
      {activeTenantSubscribers && (
        <div className="modal-backdrop" onClick={() => setActiveTenantSubscribers(null)}>
          <div className="team-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="team-modal-header">
              <div>
                <h3 className="team-modal-title">{activeTenantSubscribers.name} — Subscribers</h3>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Super Admin control: Activate or deactivate subscribers in this tenant
                </span>
              </div>
              <button
                type="button"
                className="team-modal-close"
                onClick={() => setActiveTenantSubscribers(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loadingSubscribers ? (
                <div style={{ textAlign: 'center', padding: '32px' }}><div className="spinner" /></div>
              ) : subscribersList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No subscribers found in this tenant.
                </div>
              ) : (
                <table className="team-table">
                  <thead>
                    <tr>
                      <th>Subscriber</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribersList.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.user?.fullName || s.user?.userId}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.user?.email}</div>
                        </td>
                        <td>
                          <span className="badge badge-secondary">
                            {s.role === 'admin' ? 'Admin' : s.role === 'manager' ? 'Manager / Coordinator' : 'Executive'}
                          </span>
                        </td>
                        <td>
                          {s.status === 'active' ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-danger">Inactive</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className={`btn-toggle-status ${s.status === 'active' ? 'deactivate' : 'activate'}`}
                            onClick={() => handleToggleSubscriberStatus(s)}
                            disabled={actionId === s.id}
                          >
                            {s.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
