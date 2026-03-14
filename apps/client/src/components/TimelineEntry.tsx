import React from 'react';

import type { JournalEntry } from '../types';
import { KeywordChip } from './KeywordChip';

type TimelineEntryProps = {
  entry: JournalEntry;
  isAnalyzing: boolean;
  onAnalyze: (entry: JournalEntry) => void;
  formatDate: (value: string) => string;
};

export function TimelineEntry({
  entry,
  isAnalyzing,
  onAnalyze,
  formatDate
}: TimelineEntryProps) {
  const hasAnalysis = Boolean(entry.analysis);

  return (
    <article className="timeline-entry">
      <div className="timeline-entry__header">
        <div className="timeline-entry__meta">
          <span className={`entry-ambience entry-ambience--${entry.ambience}`}>{entry.ambience}</span>
          <time className="timeline-entry__timestamp">{formatDate(entry.createdAt)}</time>
        </div>

        <button
          className="button button--secondary button--small timeline-entry__action"
          type="button"
          onClick={() => onAnalyze(entry)}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : entry.analysis ? 'Analyze again' : 'Analyze'}
        </button>
      </div>

      <p className="timeline-entry__text">{entry.text}</p>

      <div className={hasAnalysis ? 'analysis-card' : 'analysis-card analysis-card--empty'}>
        <div className="analysis-card__header">
          <span className="analysis-card__label">Stored analysis</span>
          {hasAnalysis ? (
            <div className="analysis-card__meta">
              <span className="analysis-card__emotion-badge">{entry.analysis?.emotion}</span>
              <time className="timeline-entry__timestamp">
                {formatDate(entry.analysis?.createdAt ?? entry.createdAt)}
              </time>
            </div>
          ) : null}
        </div>

        <p className="analysis-card__summary">
          {entry.analysis?.summary ?? 'No analysis stored for this entry yet.'}
        </p>
      </div>

      {entry.analysis?.keywords.length ? (
        <div className="chip-row timeline-entry__chips">
          {entry.analysis.keywords.map((keyword) => (
            <KeywordChip key={`${entry.id}-${keyword}`} tone="sage">
              {keyword}
            </KeywordChip>
          ))}
        </div>
      ) : null}
    </article>
  );
}
