import type { InputHTMLAttributes } from 'react';
import React, { forwardRef } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, style, ...props },
  ref
) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
      <span style={{ fontWeight: 600, letterSpacing: '0.015em' }}>{label}</span>
      <input
        {...props}
        ref={ref}
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          borderRadius: '0.85rem',
          border: `1px solid ${error ? 'rgba(248, 113, 113, 0.6)' : 'rgba(148, 163, 184, 0.3)'}`,
          color: '#f8fafc',
          fontSize: '1rem',
          padding: '0.9rem 1.1rem',
          outline: 'none',
          transition: 'border 0.18s ease',
          ...style
        }}
        onFocus={event => {
          event.currentTarget.style.border = `1px solid ${error ? 'rgba(248, 113, 113, 0.85)' : '#38bdf8'}`;
          props.onFocus?.(event);
        }}
        onBlur={event => {
          event.currentTarget.style.border = `1px solid ${error ? 'rgba(248, 113, 113, 0.6)' : 'rgba(148, 163, 184, 0.3)'}`;
          props.onBlur?.(event);
        }}
      />
      {hint && !error && <span style={{ color: 'rgba(148, 163, 184, 0.75)' }}>{hint}</span>}
      {error && <span style={{ color: 'rgba(248, 113, 113, 0.9)' }}>{error}</span>}
    </label>
  );
});
