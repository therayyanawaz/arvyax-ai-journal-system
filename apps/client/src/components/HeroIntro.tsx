import React from 'react';

type HeroIntroProps = {
  signalLine: string | null;
};

export function HeroIntro({ signalLine }: HeroIntroProps) {
  return (
    <section className="hero-intro">
      <p className="eyebrow">ArvyaX AI-Assisted Journal System</p>
      <div className="hero-intro__copy">
        <h1 className="hero-intro__headline">
          Nature sessions, reflective writing, and persistent AI insights.
        </h1>
        <p className="hero-intro__lead">
          Capture what changed after each forest, ocean, or mountain session. Analyze entries with
          a real LLM, then watch recurring patterns settle across time.
        </p>
        {signalLine ? <p className="hero-intro__signal">{signalLine}</p> : null}
      </div>
    </section>
  );
}
