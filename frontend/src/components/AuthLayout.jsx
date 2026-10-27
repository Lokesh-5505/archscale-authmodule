import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { useAuth } from '../auth/useAuth.js';
import './AuthLayout.css';

export function AuthLayout({
  children,
  wide = false,
  showAvatar = false,
  title,
  subtitle,
}) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="auth-layout">
      {/* Top Header */}
      <header className="auth-header">
        <Link to="/" className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 22 22 22 12 2"></polygon>
              <line x1="8" y1="16" x2="16" y2="16"></line>
            </svg>
          </div>
          <span className="auth-logo-text">
            Arch<span>Scale</span>
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a
            href="mailto:hello@archscale.in?subject=ArchScale%20Support"
            className="auth-help-link"
          >
            Help
          </a>
          {showAvatar && isAuthenticated && <Avatar />}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="auth-content">
        <div className={`auth-card-wrapper ${wide ? 'wide' : ''} animate-fade-in`}>
          <div className="glass-card auth-card">
            {(title || subtitle) && (
              <div style={{ marginBottom: '28px', textAlign: 'center' }}>
                {title && <h1 style={{ fontSize: '1.65rem', marginBottom: '8px' }}>{title}</h1>}
                {subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="auth-footer">
        <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
        <span>&bull;</span>
        <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a>
        <span>&bull;</span>
        <span>&copy; {new Date().getFullYear()} ArchScale Inc.</span>
      </footer>
    </div>
  );
}
