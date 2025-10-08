import type { ButtonHTMLAttributes } from 'react';
import React, { useEffect } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(120deg, #38bdf8 0%, #0ea5e9 100%)',
    color: '#0f172a'
  },
  secondary: {
    background: 'rgba(15, 23, 42, 0.8)',
    color: '#e2e8f0',
    border: '1px solid rgba(148, 163, 184, 0.35)'
  },
  ghost: {
    background: 'transparent',
    color: '#e2e8f0',
    border: '1px solid rgba(148, 163, 184, 0.2)'
  }
};

let spinnerStylesInjected = false;

function ensureSpinnerStyles(): void {
  if (spinnerStylesInjected || typeof document === 'undefined') {
    return;
  }

  const style = document.createElement('style');
  style.id = 'design-system-spinner';
  style.textContent = `@keyframes design-system-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
  spinnerStylesInjected = true;
}

export function Button({ label, variant = 'primary', loading = false, disabled, style, ...props }: ButtonProps): JSX.Element {
  useEffect(() => {
    ensureSpinnerStyles();
  }, []);

  const mergedStyle: React.CSSProperties = {
    borderRadius: '0.75rem',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    fontSize: '1rem',
    fontWeight: 600,
    padding: '0.85rem 1.75rem',
    letterSpacing: '0.02em',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    boxShadow: disabled || loading ? 'none' : '0 18px 35px rgba(56, 189, 248, 0.25)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.65rem',
    justifyContent: 'center',
    ...variantStyles[variant],
    ...style
  };

  const content = loading ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span
        aria-hidden
        style={{
          width: '1rem',
          height: '1rem',
          borderRadius: '9999px',
          border: '2px solid rgba(15, 23, 42, 0.25)',
          borderTopColor: 'rgba(15, 23, 42, 0.75)',
          animation: 'design-system-spin 0.75s linear infinite'
        }}
      />
      {label}
    </span>
  ) : (
    label
  );

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={mergedStyle}
      onMouseDown={event => {
        if (!disabled && !loading) {
          event.currentTarget.style.transform = 'scale(0.98)';
        }
        props.onMouseDown?.(event);
      }}
      onMouseUp={event => {
        event.currentTarget.style.transform = 'scale(1)';
        props.onMouseUp?.(event);
      }}
      onMouseLeave={event => {
        event.currentTarget.style.transform = 'scale(1)';
        props.onMouseLeave?.(event);
      }}
    >
      {content}
    </button>
  );
}
