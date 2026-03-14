import React, { type ReactNode } from 'react';

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
  className
}: SectionHeaderProps) {
  return (
    <div className={className ? `section-header ${className}` : 'section-header'}>
      <div className="section-header__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-header__title">{title}</h2>
        {description ? <p className="section-header__description">{description}</p> : null}
      </div>

      {aside ? <div className="section-header__aside">{aside}</div> : null}
    </div>
  );
}
