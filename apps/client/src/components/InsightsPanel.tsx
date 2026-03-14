import React from 'react';

import type { Insights } from '../types';
import { KeywordChip } from './KeywordChip';
import { MetricCard } from './MetricCard';
import { SectionHeader } from './SectionHeader';

type InsightsPanelProps = {
  insights: Insights;
  analyzedCount: number;
  isLoading: boolean;
};

export function InsightsPanel({ insights, analyzedCount, isLoading }: InsightsPanelProps) {
  const archiveMeta = isLoading
    ? 'Loading archive...'
    : `${insights.totalEntries} entries • ${analyzedCount} analyzed`;

  return (
    <article className="insights-panel">
      <SectionHeader
        eyebrow="Insights"
        title="Patterns settling over time"
        description="One place for the archive to say what keeps returning as the journal grows."
        aside={<p className="insights-panel__meta">{archiveMeta}</p>}
      />

      <div className="insights-panel__mosaic">
        <article className="insights-panel__lead">
          <span className="metric-card__label">Archive depth</span>
          <strong className="insights-panel__lead-value">
            {isLoading ? 'Loading...' : insights.totalEntries}
          </strong>
          <p className="insights-panel__lead-copy">
            Every saved reflection adds context to the archive and makes the recurring threads
            easier to trust.
          </p>
        </article>
        <MetricCard
          className="insights-panel__support"
          tone="sand"
          label="Most used ambience"
          value={isLoading ? 'Loading...' : insights.mostUsedAmbience ?? 'None yet'}
          detail="The setting you return to most often."
        />
        <MetricCard
          className="insights-panel__support"
          tone="sage"
          label="Top emotion"
          value={isLoading ? 'Loading...' : insights.topEmotion ?? 'None yet'}
          detail="The clearest emotional thread surfacing across analysis."
        />
      </div>

      <div className="insights-panel__keywords">
        <div className="insights-panel__keywords-heading">
          <span className="field__label">Recent keywords</span>
          <p className="support-copy">Terms that keep surfacing in the stored summaries.</p>
        </div>

        <div className="chip-row">
          {(isLoading ? [] : insights.recentKeywords).map((keyword) => (
            <KeywordChip key={keyword} tone="forest">
              {keyword}
            </KeywordChip>
          ))}

          {!isLoading && insights.recentKeywords.length === 0 ? (
            <p className="support-copy">Analyze entries to populate the keyword set.</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
