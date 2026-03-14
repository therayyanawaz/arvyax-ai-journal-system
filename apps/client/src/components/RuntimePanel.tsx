import React from 'react';

import type { ProviderState, ProviderStatus } from '../types';
import { SectionHeader } from './SectionHeader';

type RuntimePanelProps = {
  userId: string;
  providerState: ProviderState;
  isProviderLoading: boolean;
  onUserIdChange: (value: string) => void;
  onProviderChange: (provider: ProviderStatus['name']) => void;
};

export function RuntimePanel({
  userId,
  providerState,
  isProviderLoading,
  onUserIdChange,
  onProviderChange
}: RuntimePanelProps) {
  const activeProvider =
    providerState.providers.find((provider) => provider.name === providerState.activeProvider) ??
    providerState.providers.find((provider) => provider.selected) ??
    null;
  const activeProviderLabel = activeProvider?.label ?? '...';
  const readinessLabel = isProviderLoading
    ? 'Checking runtime...'
    : activeProvider?.ready
      ? 'Ready for live analysis'
      : 'Runtime unavailable';
  const helperCopy =
    activeProvider?.reason ??
    (activeProvider?.name === 'codexChatgpt'
      ? 'Use the trusted ChatGPT browser session when the local Codex provider is available.'
      : 'Use direct OpenAI API credentials when the backend is configured for API mode.');

  return (
    <article className="runtime-panel">
      <SectionHeader
        eyebrow="AI Runtime"
        title="Provider runtime"
        description="Choose the analysis path, then confirm whether the current runtime is ready."
      />

      <div className="runtime-panel__fields">
        <label className="field">
          <span className="field__label">User ID</span>
          <input
            className="control"
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="Enter a user ID"
          />
        </label>

        <label className="field">
          <span className="field__label">AI provider</span>
          <div className="select-wrap">
            <select
              className="control select-control"
              value={providerState.activeProvider}
              onChange={(event) => onProviderChange(event.target.value as ProviderStatus['name'])}
              disabled={isProviderLoading}
            >
              {providerState.providers.map((provider) => (
                <option key={provider.name} value={provider.name} disabled={!provider.available}>
                  {provider.label}
                  {!provider.available ? ' (Unavailable)' : ''}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="runtime-panel__status">
        <div>
          <span className="field__label">Active provider</span>
          <p className="runtime-panel__provider-name">{activeProviderLabel}</p>
        </div>
        <p className="runtime-panel__readiness">{readinessLabel}</p>
      </div>

      <p className="support-copy">{helperCopy}</p>
    </article>
  );
}
