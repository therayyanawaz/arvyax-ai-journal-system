import React, { type ReactNode } from 'react';

type KeywordChipTone = 'forest' | 'sage' | 'stone';

type KeywordChipProps = {
  children: ReactNode;
  tone?: KeywordChipTone;
  className?: string;
};

export function KeywordChip({
  children,
  tone = 'forest',
  className
}: KeywordChipProps) {
  const classes = ['keyword-chip', `keyword-chip--${tone}`, className].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
}
