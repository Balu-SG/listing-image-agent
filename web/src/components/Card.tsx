import type { ReactNode } from 'react';
import { cx } from '../lib';

export function Card({ title, icon, action, children, className }: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6', className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2 text-base font-semibold">
              {icon && <span className="text-accent">{icon}</span>}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function ScoreDelta({ before, after }: { before: number; after: number | null }) {
  const d = after === null ? null : Math.round(after) - Math.round(before);
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span className="text-muted">{Math.round(before)}</span>
      <span aria-hidden className="text-muted">→</span>
      <span className="sr-only">to</span>
      <span className="font-semibold">{after === null ? '–' : Math.round(after)}</span>
      {d !== null && d !== 0 && (
        <span className={cx('text-xs font-semibold', d > 0 ? 'text-pass' : 'text-bad')}>
          {d > 0 ? `+${d}` : d}
        </span>
      )}
    </span>
  );
}
