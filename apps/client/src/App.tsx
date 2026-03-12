import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

type Analysis = {
  emotion: string;
  keywords: string[];
  summary: string;
};

type JournalEntry = {
  id: string;
  userId: string;
  ambience: string;
  text: string;
  createdAt: string;
  analysis: (Analysis & {
    id: string;
    createdAt: string;
    textHash: string;
  }) | null;
};

type Insights = {
  totalEntries: number;
  topEmotion: string | null;
  mostUsedAmbience: string | null;
  recentKeywords: string[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const ambienceOptions = ['forest', 'ocean', 'mountain'];

const emptyInsights: Insights = {
  totalEntries: 0,
  topEmotion: null,
  mostUsedAmbience: null,
  recentKeywords: []
};

export default function App() {
  const [userId, setUserId] = useState('123');
  const [ambience, setAmbience] = useState('forest');
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [insights, setInsights] = useState<Insights>(emptyInsights);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [analyzingEntryId, setAnalyzingEntryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  async function refreshUserData(currentUserId: string) {
    try {
      setErrorMessage(null);
      await Promise.all([loadEntries(currentUserId), loadInsights(currentUserId)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load journal data.');
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshUserData(userId.trim());
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [userId]);

  const analyzedCount = useMemo(() => {
    return entries.filter((entry) => entry.analysis).length;
  }, [entries]);

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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to analyze entry.');
    } finally {
      setAnalyzingEntryId(null);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">ArvyaX AI-Assisted Journal System</p>
          <h1>Nature sessions, reflective writing, and persistent AI insights.</h1>
          <p className="hero-copy">
            Capture what changed after each forest, ocean, or mountain session. Analyze entries
            with a real LLM, then watch recurring patterns settle across time.
          </p>
        </div>

        <div className="hero-panel">
          <label className="field">
            <span>User ID</span>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Enter a user ID"
            />
          </label>

          <div className="metrics">
            <article>
              <span>Total entries</span>
              <strong>{isInsightsLoading ? '...' : insights.totalEntries}</strong>
            </article>
            <article>
              <span>Analyzed</span>
              <strong>{analyzedCount}</strong>
            </article>
            <article>
              <span>Top emotion</span>
              <strong>{isInsightsLoading ? '...' : insights.topEmotion ?? 'None yet'}</strong>
            </article>
          </div>
        </div>
      </section>

      {errorMessage ? <div className="banner-error">{errorMessage}</div> : null}

      <section className="layout">
        <div className="column">
          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">New Entry</p>
                <h2>Write after the session</h2>
              </div>
            </div>

            <form className="journal-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Ambience</span>
                <select value={ambience} onChange={(event) => setAmbience(event.target.value)}>
                  {ambienceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Journal entry</span>
                <textarea
                  rows={7}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="What shifted for you during the session?"
                />
              </label>

              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving entry...' : 'Create entry'}
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Insights</p>
                <h2>Aggregated over time</h2>
              </div>
            </div>

            <div className="insight-grid">
              <article className="insight-card">
                <span>Total entries</span>
                <strong>{isInsightsLoading ? 'Loading...' : insights.totalEntries}</strong>
              </article>
              <article className="insight-card">
                <span>Most used ambience</span>
                <strong>{isInsightsLoading ? 'Loading...' : insights.mostUsedAmbience ?? 'None yet'}</strong>
              </article>
              <article className="insight-card">
                <span>Top emotion</span>
                <strong>{isInsightsLoading ? 'Loading...' : insights.topEmotion ?? 'None yet'}</strong>
              </article>
            </div>

            <div className="keyword-row">
              {(isInsightsLoading ? [] : insights.recentKeywords).map((keyword) => (
                <span key={keyword} className="pill">
                  {keyword}
                </span>
              ))}
              {!isInsightsLoading && insights.recentKeywords.length === 0 ? (
                <p className="muted">Analyze entries to populate recent keywords.</p>
              ) : null}
            </div>
          </article>
        </div>

        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>Previous entries</h2>
            </div>
            <span className="muted">{isEntriesLoading ? 'Loading...' : `${entries.length} entries`}</span>
          </div>

          <div className="entry-list">
            {!isEntriesLoading && entries.length === 0 ? (
              <div className="empty-state">No entries found for this user yet.</div>
            ) : null}

            {entries.map((entry) => (
              <article className="entry-card" key={entry.id}>
                <div className="entry-header">
                  <div>
                    <span className="entry-ambience">{entry.ambience}</span>
                    <time>{formatDate(entry.createdAt)}</time>
                  </div>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void handleAnalyze(entry)}
                    disabled={analyzingEntryId === entry.id}
                  >
                    {analyzingEntryId === entry.id
                      ? 'Analyzing...'
                      : entry.analysis
                        ? 'Analyze again'
                        : 'Analyze'}
                  </button>
                </div>

                <p className="entry-text">{entry.text}</p>

                {entry.analysis ? (
                  <div className="analysis-box">
                    <div className="analysis-topline">
                      <strong>{entry.analysis.emotion}</strong>
                      <span>{formatDate(entry.analysis.createdAt)}</span>
                    </div>
                    <p>{entry.analysis.summary}</p>
                    <div className="keyword-row">
                      {entry.analysis.keywords.map((keyword) => (
                        <span key={`${entry.id}-${keyword}`} className="pill">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="muted">No analysis stored for this entry yet.</p>
                )}
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
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

