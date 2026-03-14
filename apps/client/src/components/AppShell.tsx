import React, { type ReactNode } from 'react';

type AppShellProps = {
  errorMessage: string | null;
  leftColumn: ReactNode;
  rightColumn: ReactNode;
};

export function AppShell({ errorMessage, leftColumn, rightColumn }: AppShellProps) {
  return (
    <main className="app-shell">
      <div className="app-shell__inner">
        {errorMessage ? (
          <div className="banner-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <div className="page-grid">
          <section className="page-main">{leftColumn}</section>
          <aside className="page-rail">{rightColumn}</aside>
        </div>
      </div>
    </main>
  );
}
