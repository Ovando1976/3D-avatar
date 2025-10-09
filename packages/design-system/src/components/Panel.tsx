import type { PropsWithChildren, ReactNode } from 'react';
import React from 'react';

export interface PanelProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  tone?: 'default' | 'success' | 'warning';
}

const toneBorders: Record<NonNullable<PanelProps['tone']>, string> = {
  default: 'rgba(148, 163, 184, 0.25)',
  success: 'rgba(74, 222, 128, 0.45)',
  warning: 'rgba(250, 204, 21, 0.45)'
};

export function Panel({ title, subtitle, footer, tone = 'default', children }: PanelProps): JSX.Element {
  return (
    <section
      style={{
        background: 'rgba(15, 23, 42, 0.88)',
        border: `1px solid ${toneBorders[tone]}`,
        borderRadius: '1.5rem',
        padding: '1.75rem',
        width: '100%',
        boxShadow: '0 24px 70px rgba(2, 6, 23, 0.55)'
      }}
    >
      {(title || subtitle) && (
        <header style={{ marginBottom: '1.25rem' }}>
          {title && (
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, letterSpacing: '0.01em' }}>{title}</h2>
          )}
          {subtitle && (
            <p style={{ marginTop: '0.35rem', marginBottom: 0, color: 'rgba(148, 163, 184, 0.85)' }}>{subtitle}</p>
          )}
        </header>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
      {footer && <footer style={{ marginTop: '1.5rem' }}>{footer}</footer>}
    </section>
  );
}
