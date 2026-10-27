import React from 'react';
import './FloatingField.css';

export function FloatingField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  autoComplete,
  disabled = false,
  readOnly = false,
  rightElement = null,
  placeholder = ' ',
}) {
  return (
    <div className="floating-field-container">
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          readOnly={readOnly}
          className={`floating-input ${error ? 'has-error' : ''}`}
          style={rightElement ? { paddingRight: '48px' } : {}}
        />
        <label htmlFor={id} className="floating-label">
          {label}
        </label>
        {rightElement && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {rightElement}
          </div>
        )}
      </div>
      {error && <div className="field-error-text animate-fade-in">{error}</div>}
    </div>
  );
}
