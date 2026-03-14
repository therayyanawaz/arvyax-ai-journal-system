import React from 'react';

import type { CodexAccountStatus, ProviderState } from '../types';
import { SectionHeader } from './SectionHeader';
import { StatusBadge } from './StatusBadge';

type AccountPanelProps = {
  providerState: ProviderState;
  codexAccount: CodexAccountStatus;
  isAuthActionLoading: boolean;
  onCodexSignIn: () => void;
  onCodexLogout: () => void;
};

export function AccountPanel({
  providerState,
  codexAccount,
  isAuthActionLoading,
  onCodexSignIn,
  onCodexLogout
}: AccountPanelProps) {
  const codexProvider = providerState.providers.find((provider) => provider.name === 'codexChatgpt');
  const helperCopy =
    codexAccount.availabilityReason ??
    'Browser-based ChatGPT sign-in backed by the official Codex app-server session flow.';

  return (
    <article className="account-panel">
      <SectionHeader
        eyebrow="ChatGPT Account"
        title="Trusted browser session"
        description="Use the local ChatGPT session flow when Codex browser login is available."
        aside={<StatusBadge status={codexAccount.authStatus} />}
      />

      <div className="button-row">
        <button
          className="button button--primary"
          type="button"
          onClick={onCodexSignIn}
          disabled={
            isAuthActionLoading ||
            !codexProvider?.available ||
            codexAccount.authStatus === 'signing-in'
          }
        >
          {codexAccount.authStatus === 'signing-in'
            ? 'Waiting for login...'
            : 'Sign in with ChatGPT'}
        </button>

        <button
          className="button button--secondary"
          type="button"
          onClick={onCodexLogout}
          disabled={isAuthActionLoading || codexAccount.authStatus !== 'signed-in'}
        >
          Sign out
        </button>
      </div>

      <p className="support-copy">{helperCopy}</p>

      <div className="account-panel__meta">
        <div className="account-tile">
          <span className="field__label">Email</span>
          <strong>{codexAccount.email ?? 'Not signed in'}</strong>
        </div>
        <div className="account-tile">
          <span className="field__label">Plan</span>
          <strong>{codexAccount.planType ?? 'Unknown'}</strong>
        </div>
      </div>
    </article>
  );
}
