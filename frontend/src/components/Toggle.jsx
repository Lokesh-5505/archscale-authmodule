import React from 'react';
import './Toggle.css';

export function Toggle({ id = 'toggle', checked, onChange, label, disabled = false }) {
  return (
    <label htmlFor={id} className={`toggle-wrapper ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <div className={`toggle-switch ${checked ? 'checked' : ''}`}>
        <div className="toggle-thumb" />
      </div>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}
