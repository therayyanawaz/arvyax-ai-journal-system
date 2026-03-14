import React from 'react';

import type { JournalEntry } from '../types';
import { SectionHeader } from './SectionHeader';
import { TimelineEntry } from './TimelineEntry';

type TimelinePanelProps = {
  entries: JournalEntry[];
  isEntriesLoading: boolean;
  analyzingEntryId: string | null;
  onAnalyze: (entry: JournalEntry) => void;
  formatDate: (value: string) => string;
};

export function TimelinePanel({
  entries,
  isEntriesLoading,
  analyzingEntryId,
  onAnalyze,
  formatDate
}: TimelinePanelProps) {
  return (
    <article className="timeline-panel">
      <SectionHeader
        eyebrow="Timeline"
        title="Previous entries"
        description="Revisit the archive, rerun analysis, and compare what each session left behind."
        aside={
          <span className="timeline-panel__count">
            {isEntriesLoading ? 'Loading...' : `${entries.length} entries`}
          </span>
        }
      />

      <div className="entry-list">
        {isEntriesLoading && entries.length === 0 ? (
          <div className="empty-state">Loading saved reflections...</div>
        ) : null}

        {!isEntriesLoading && entries.length === 0 ? (
          <div className="empty-state">No entries found for this user yet.</div>
        ) : null}

        {entries.map((entry) => (
          <TimelineEntry
            key={entry.id}
            entry={entry}
            isAnalyzing={analyzingEntryId === entry.id}
            onAnalyze={onAnalyze}
            formatDate={formatDate}
          />
        ))}
      </div>
    </article>
  );
}
