import React, { type ReactNode } from 'react';

type MetricTone = 'forest' | 'sage' | 'sand' | 'stone';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: MetricTone;
  className?: string;
};

export function MetricCard({
  label,
  value,
  detail,
  tone = 'stone',
  className
}: MetricCardProps) {
  const classes = ['metric-card', `metric-card--${tone}`, className].filter(Boolean).join(' ');

  return (
    <article className={classes}>
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      {detail ? <p className="metric-card__detail">{detail}</p> : null}
    </article>
  );
}
