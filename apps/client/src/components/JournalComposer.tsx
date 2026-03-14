import React, { type FormEvent } from 'react';

import { SectionHeader } from './SectionHeader';

type JournalComposerProps = {
  ambience: string;
  ambienceOptions: string[];
  text: string;
  isSubmitting: boolean;
  onAmbienceChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function JournalComposer({
  ambience,
  ambienceOptions,
  text,
  isSubmitting,
  onAmbienceChange,
  onTextChange,
  onSubmit
}: JournalComposerProps) {
  return (
    <article className="composer-panel">
      <SectionHeader
        eyebrow="New Entry"
        title="Write after the session"
        description="Stay close to the feeling of the session. The archive will hold the long-term pattern work."
      />

      <form className="journal-form" onSubmit={onSubmit}>
        <div className="field">
          <span className="field__label">Session ambience</span>
          <div className="composer-panel__ambience" role="group" aria-label="Session ambience">
            {ambienceOptions.map((option) => {
              const isActive = ambience === option;
              return (
                <button
                  key={option}
                  className={
                    isActive
                      ? 'ambience-pill ambience-pill--active'
                      : 'ambience-pill'
                  }
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onAmbienceChange(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <label className="field">
          <span className="field__label">Journal entry</span>
          <textarea
            className="control textarea-control"
            rows={8}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="What shifted for you during the session?"
          />
        </label>

        <div className="journal-form__footer">
          <p className="support-copy">
            New reflections land in the timeline immediately and can be analyzed again when the
            archive deepens.
          </p>

          <button
            className="button button--primary button--stretch-mobile"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving entry...' : 'Create entry'}
          </button>
        </div>
      </form>
    </article>
  );
}
