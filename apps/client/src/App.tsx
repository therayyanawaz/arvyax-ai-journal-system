import React, { type FormEvent, useEffect, useMemo, useState } from 'react';

import { AppShell } from './components/AppShell';
import { AccountPanel } from './components/AccountPanel';
import { HeroIntro } from './components/HeroIntro';
import { InsightsPanel } from './components/InsightsPanel';
import { JournalComposer } from './components/JournalComposer';
import { RuntimePanel } from './components/RuntimePanel';
import { TimelinePanel } from './components/TimelinePanel';
import type {
  Analysis,
  CodexAccountStatus,
  Insights,
  JournalEntry,
  LoginStatus,
  ProviderState,
  ProviderStatus
} from './types';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = viteEnv?.VITE_API_BASE_URL ?? 'http://localhost:4000';
const ambienceOptions = ['forest', 'ocean', 'mountain'];

const emptyInsights: Insights = {
  totalEntries: 0,
  topEmotion: null,
  mostUsedAmbience: null,
  recentKeywords: []
};

const emptyProviderState: ProviderState = {
  activeProvider: 'openaiApi',
  providers: []
};

const emptyCodexAccount: CodexAccountStatus = {
  enabled: false,
  available: false,
  ready: false,
  authStatus: 'unavailable',
  authMode: null,
  email: null,
  planType: null,
  requiresOpenaiAuth: null,
  rateLimits: null,
  availabilityReason: null,
  activeLoginId: null
};

export default function App() {
  const [userId, setUserId] = useState('123');
  const [ambience, setAmbience] = useState('forest');
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [insights, setInsights] = useState<Insights>(emptyInsights);
  const [providerState, setProviderState] = useState<ProviderState>(emptyProviderState);
  const [codexAccount, setCodexAccount] = useState<CodexAccountStatus>(emptyCodexAccount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const [isAuthActionLoading, setIsAuthActionLoading] = useState(false);
  const [analyzingEntryId, setAnalyzingEntryId] = useState<string | null>(null);
  const [pendingLoginId, setPendingLoginId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const analyzedCount = useMemo(() => entries.filter((entry) => entry.analysis).length, [entries]);
  const heroSignal =
    !isInsightsLoading && insights.topEmotion
      ? `Current thread: ${insights.topEmotion} recurring`
      : null;

  async function request<T>(path: string, init?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      },
      ...init
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload?.error?.message ?? `Request failed with status ${response.status}.`;
      throw new Error(message);
    }

    return payload as T;
  }

  async function loadEntries(currentUserId: string) {
    if (!currentUserId.trim()) {
      setEntries([]);
      return;
    }

    setIsEntriesLoading(true);
    try {
      const data = await request<JournalEntry[]>(`/api/journal/${encodeURIComponent(currentUserId)}`);
      setEntries(data);
    } finally {
      setIsEntriesLoading(false);
    }
  }

  async function loadInsights(currentUserId: string) {
    if (!currentUserId.trim()) {
      setInsights(emptyInsights);
      return;
    }

    setIsInsightsLoading(true);
    try {
      const data = await request<Insights>(
        `/api/journal/insights/${encodeURIComponent(currentUserId)}`
      );
      setInsights(data);
    } finally {
      setIsInsightsLoading(false);
    }
  }

  async function loadProviderState() {
    setIsProviderLoading(true);
    try {
      const data = await request<ProviderState>('/api/ai/provider');
      setProviderState(data);
    } finally {
      setIsProviderLoading(false);
    }
  }

  async function loadCodexAccount() {
    const data = await request<CodexAccountStatus>('/api/auth/codex/account');
    setCodexAccount(data);
  }

  async function refreshUserData(currentUserId: string) {
    try {
      setErrorMessage(null);
      await Promise.all([loadEntries(currentUserId), loadInsights(currentUserId)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load journal data.');
    }
  }

  async function refreshAiState() {
    try {
      await Promise.all([loadProviderState(), loadCodexAccount()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load AI provider state.');
    }
  }

  useEffect(() => {
    void refreshAiState();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshUserData(userId.trim());
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [userId]);

  useEffect(() => {
    if (!pendingLoginId) {
      return;
    }

    const poll = async () => {
      try {
        const status = await request<LoginStatus>(
          `/api/auth/codex/status/${encodeURIComponent(pendingLoginId)}`
        );

        if (status.status === 'pending') {
          setCodexAccount((current) => ({
            ...current,
            authStatus: 'signing-in',
            activeLoginId: status.loginId
          }));
          return;
        }

        setPendingLoginId(null);
        await refreshAiState();

        if (status.status === 'error') {
          setErrorMessage(status.error ?? 'Codex ChatGPT login failed.');
        }
      } catch (error) {
        setPendingLoginId(null);
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to poll Codex login status.'
        );
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pendingLoginId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId.trim() || !text.trim()) {
      setErrorMessage('Enter a user ID and journal text before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await request<JournalEntry>('/api/journal', {
        method: 'POST',
        body: JSON.stringify({
          userId: userId.trim(),
          ambience,
          text: text.trim()
        })
      });

      setText('');
      await refreshUserData(userId.trim());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save journal entry.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAnalyze(entry: JournalEntry) {
    setAnalyzingEntryId(entry.id);
    setErrorMessage(null);

    try {
      await request<Analysis>('/api/journal/analyze', {
        method: 'POST',
        body: JSON.stringify({
          journalEntryId: entry.id,
          text: entry.text
        })
      });

      await refreshUserData(entry.userId);
      await refreshAiState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to analyze entry.');
    } finally {
      setAnalyzingEntryId(null);
    }
  }

  async function handleProviderChange(provider: ProviderStatus['name']) {
    setErrorMessage(null);

    try {
      const data = await request<ProviderState>('/api/ai/provider', {
        method: 'POST',
        body: JSON.stringify({ provider })
      });
      setProviderState(data);
      await loadCodexAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to switch AI provider.');
    }
  }

  async function handleCodexSignIn() {
    setIsAuthActionLoading(true);
    setErrorMessage(null);

    try {
      const data = await request<{ loginId: string; authUrl: string }>('/api/auth/codex/start', {
        method: 'POST'
      });

      setPendingLoginId(data.loginId);
      setCodexAccount((current) => ({
        ...current,
        authStatus: 'signing-in',
        activeLoginId: data.loginId
      }));

      const popup = window.open(data.authUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        setErrorMessage('Browser blocked the ChatGPT login window. Allow popups and try again.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start Codex login.');
    } finally {
      setIsAuthActionLoading(false);
    }
  }

  async function handleCodexLogout() {
    setIsAuthActionLoading(true);
    setErrorMessage(null);

    try {
      await request<{ success: boolean }>('/api/auth/codex/logout', {
        method: 'POST'
      });
      setPendingLoginId(null);
      await refreshAiState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to log out of Codex.');
    } finally {
      setIsAuthActionLoading(false);
    }
  }

  return (
    <AppShell
      errorMessage={errorMessage}
      leftColumn={
        <>
          <HeroIntro signalLine={heroSignal} />
          <JournalComposer
            ambience={ambience}
            ambienceOptions={ambienceOptions}
            text={text}
            isSubmitting={isSubmitting}
            onAmbienceChange={setAmbience}
            onTextChange={setText}
            onSubmit={handleSubmit}
          />
          <InsightsPanel
            insights={insights}
            analyzedCount={analyzedCount}
            isLoading={isInsightsLoading}
          />
        </>
      }
      rightColumn={
        <>
          <RuntimePanel
            userId={userId}
            providerState={providerState}
            isProviderLoading={isProviderLoading}
            onUserIdChange={setUserId}
            onProviderChange={(provider) => void handleProviderChange(provider)}
          />
          <AccountPanel
            providerState={providerState}
            codexAccount={codexAccount}
            isAuthActionLoading={isAuthActionLoading}
            onCodexSignIn={() => void handleCodexSignIn()}
            onCodexLogout={() => void handleCodexLogout()}
          />
          <TimelinePanel
            entries={entries}
            isEntriesLoading={isEntriesLoading}
            analyzingEntryId={analyzingEntryId}
            onAnalyze={(entry) => void handleAnalyze(entry)}
            formatDate={formatDate}
          />
        </>
      }
    />
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
