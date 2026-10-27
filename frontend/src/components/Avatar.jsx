import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import './Avatar.css';

export function Avatar({ size = 'md', interactive = true }) {
  const { user, contexts, logout, logoutAll } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.initials || 'AS';

  if (!interactive) {
    return (
      <div className={`avatar-circle ${size}`}>
        {initials}
      </div>
    );
  }

  return (
    <div className="avatar-container" ref={containerRef}>
      <button
        type="button"
        className={`avatar-circle ${size}`}
        onClick={() => setOpen(!open)}
        aria-label="User navigation menu"
      >
        {initials}
      </button>

      {open && (
        <div className="avatar-dropdown">
          <div className="avatar-dropdown-header">
            <div className="avatar-dropdown-name">{user?.fullName || 'User'}</div>
            <div className="avatar-dropdown-id">@{user?.userId}</div>
          </div>

          {/* Subscribers with multiple organizations have profile switcher */}
          {user?.platformRole === null && contexts?.length > 1 && (
            <button
              type="button"
              className="avatar-dropdown-item"
              onClick={() => {
                setOpen(false);
                navigate('/choose-profile');
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Switch Profile</span>
            </button>
          )}

          {/* Super admin shortcut to invitations */}
          {user?.platformRole === 'super_admin' && (
            <button
              type="button"
              className="avatar-dropdown-item"
              onClick={() => {
                setOpen(false);
                navigate('/admin/invitations');
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span>Manage Invitations</span>
            </button>
          )}

          <button
            type="button"
            className="avatar-dropdown-item"
            onClick={() => {
              setOpen(false);
              navigate('/security');
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Account & Security</span>
          </button>

          <div className="avatar-dropdown-divider" />

          <button
            type="button"
            className="avatar-dropdown-item"
            style={{ color: 'var(--color-danger)' }}
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/login');
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Log out</span>
          </button>

          <button
            type="button"
            className="avatar-dropdown-item"
            style={{ color: 'var(--color-danger)' }}
            onClick={async () => {
              setOpen(false);
              await logoutAll();
              navigate('/login');
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
            <span>Log out of all devices</span>
          </button>
        </div>
      )}
    </div>
  );
}
