import React from 'react';
import './ProfileCard.css';

// SVG Icons tailored for subscriber roles
function renderRoleIcon(role) {
  switch (role) {
    case 'admin':
    case 'studio_owner':
    case 'owner':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      );
    case 'manager':
    case 'project_owner':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      );
    case 'executive':
    case 'vendor_owner':
    case 'member':
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      );
  }
}

const roleLabels = {
  admin: 'Admin',
  manager: 'Manager / Coordinator',
  executive: 'Executive',
  studio_owner: 'Admin',
  project_owner: 'Manager / Coordinator',
  vendor_owner: 'Executive',
  owner: 'Admin',
  member: 'Executive',
};

export function ProfileCard({
  context,
  selected = false,
  onSelect,
}) {
  const { role, tenantType, organizationName, isLastUsed, isActive, tenantStatus, subscriberStatus } = context;
  const effectiveRole = role || tenantType || 'executive';
  const label = roleLabels[effectiveRole] || 'Subscriber';

  return (
    <div
      className={`profile-card ${selected ? 'selected' : ''} ${!isActive ? 'disabled' : ''}`}
      onClick={() => {
        if (isActive && onSelect) {
          onSelect(context);
        }
      }}
      role="button"
      tabIndex={isActive ? 0 : -1}
      aria-disabled={!isActive}
    >
      <div className="profile-card-top">
        <div className="profile-card-icon">
          {renderRoleIcon(effectiveRole)}
        </div>
        <div className="profile-card-badges">
          {isLastUsed && <span className="badge badge-primary">Last used</span>}
          {tenantStatus === 'deactivated' && (
            <span className="badge badge-danger">Workspace Deactivated</span>
          )}
          {tenantStatus !== 'deactivated' && subscriberStatus === 'inactive' && (
            <span className="badge badge-danger">Access Inactive</span>
          )}
          {!isActive && tenantStatus !== 'deactivated' && subscriberStatus !== 'inactive' && (
            <span className="badge badge-danger">Access Suspended</span>
          )}
        </div>
      </div>

      <div className="profile-card-title">{label}</div>
      <div className="profile-card-org">{organizationName}</div>

      {selected && (
        <div className="profile-card-check">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      )}
    </div>
  );
}
