import type { PropsWithChildren } from 'react';
import React from 'react';

export interface StackProps extends PropsWithChildren {
  direction?: 'row' | 'column';
  spacing?: number;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
}

const justifyMap: Record<NonNullable<StackProps['justify']>, React.CSSProperties['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between'
};

const alignMap: Record<NonNullable<StackProps['align']>, React.CSSProperties['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end'
};

export function Stack({
  direction = 'column',
  spacing = 16,
  align = 'start',
  justify = 'start',
  wrap = false,
  children
}: StackProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: `${spacing}px`,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        flexWrap: wrap ? 'wrap' : 'nowrap',
        width: '100%'
      }}
    >
      {children}
    </div>
  );
}
