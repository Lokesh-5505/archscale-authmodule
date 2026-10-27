import React from 'react';
import { Button } from './Button.jsx';
import './SessionRow.css';

export function SessionRow({ session, onRevoke, isRevoking = false }) {
  const { id, device, ip, lastActiveAt, isCurrent } = session;

  // Relative or formatted time
  const formattedTime = new Date(lastActiveAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isMobile = device.deviceType === 'mobile' || device.deviceType === 'tablet';

  return (
    <div className={`session-row ${isCurrent ? 'current-device' : ''}`}>
      <div className="session-left">
        <div className="session-device-icon">
          {isMobile ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          )}
        </div>

        <div className="session-info">
          <div className="session-name">
            {device.browser || 'Web Browser'} on {device.os || 'System'}
            {isCurrent && <span className="badge badge-primary">This device</span>}
          </div>
          <div className="session-meta">
            IP: {ip} &bull; Last active: {formattedTime}
          </div>
        </div>
      </div>

      <div className="session-right">
        {!isCurrent && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(id)}
            loading={isRevoking}
          >
            Log out
          </Button>
        )}
      </div>
    </div>
  );
}
