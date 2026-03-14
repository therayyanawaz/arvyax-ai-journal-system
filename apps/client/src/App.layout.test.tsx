import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import App from './App';

test('renders a premium two-column shell with distinct product sections', () => {
  const markup = renderToStaticMarkup(<App />);

  assert.match(markup, /\bapp-shell\b/);
  assert.match(markup, /\bpage-grid\b/);
  assert.match(markup, /\bpage-main\b/);
  assert.match(markup, /\bpage-rail\b/);
  assert.match(markup, /\bhero-intro\b/);
  assert.match(markup, /\bcomposer-panel\b/);
  assert.match(markup, /\bcomposer-panel__ambience\b/);
  assert.match(markup, /\binsights-panel\b/);
  assert.match(markup, /\baccount-panel\b/);
  assert.match(markup, /\bruntime-panel\b/);
  assert.match(markup, /\btimeline-panel\b/);
  assert.match(markup, /\binsights-panel__lead\b/);
  assert.match(markup, /\bentry-list\b/);
  assert.doesNotMatch(markup, /\bhero-intro__summary\b/);
  assert.doesNotMatch(markup, /\bruntime-panel__stats\b/);
});
