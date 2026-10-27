import React from 'react';
import './ProfileCard.css';

// SVG Icons tailored for each tenant profile type
function renderTenantIcon(tenantType) {
  switch (tenantType) {
    case 'project_owner':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
      );
    case 'studio_owner':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
      );
    case 'vendor_owner':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      );
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      );
  }
}

const typeLabels = {
  project_owner: 'Project owner',
  studio_owner: 'Studio owner',
  vendor_owner: 'Vendor owner',
};

export function ProfileCard({
  context,
  selected = false,
  onSelect,
}) {
  const { tenantType, organizationName, isLastUsed, isActive } = context;
  const label = typeLabels[tenantType] || 'Member';

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
          {renderTenantIcon(tenantType)}
        </div>
        <div className="profile-card-badges">
          {isLastUsed && <span className="badge badge-primary">Last used</span>}
          {!isActive && <span className="badge badge-danger">Membership ended</span>}
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
