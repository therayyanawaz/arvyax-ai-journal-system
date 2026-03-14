import React from 'react';

import type { CodexAccountStatus } from '../types';

const labels: Record<CodexAccountStatus['authStatus'], string> = {
  'signed-in': 'Signed in',
  'signing-in': 'Signing in',
  error: 'Error',
  'signed-out': 'Not signed in',
  unavailable: 'Unavailable'
};

type StatusBadgeProps = {
  status: CodexAccountStatus['authStatus'];
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
