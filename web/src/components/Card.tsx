import type { ReactNode } from 'react';
import { cx } from '../lib';

/** A hairline-bordered panel with an optional header row. */
export function Panel({
  title,
  help,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
  as: Tag = 'section',
}: {
  title?: ReactNode;
  help?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No body padding: rows run edge to edge. */
  flush?: boolean;
  as?: 'section' | 'div';
}) {
  return (
    <Tag className={cx('min-w-0 rounded-xl border border-line bg-surface shadow-xs', className)}>
      {(title || action) && (
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 sm:px-5">
          {title && (
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[-0.005em]">
              {title}
              {help}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className={cx(!flush && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
    </Tag>
  );
}

export function ScoreDelta({ before, after, size = 'sm' }: { before: number; after: number | null; size?: 'sm' | 'md' }) {
  const d = after === null ? null : Math.round(after) - Math.round(before);
  return (
    <span className={cx('num inline-flex items-baseline gap-1.5', size === 'md' ? 'text-sm' : 'text-[12.5px]')}>
      <span className="text-subtle">{Math.round(before)}</span>
      <span aria-hidden className="text-subtle">
        →
      </span>
      <span className="sr-only">to</span>
      <span className="font-semibold text-fg">{after === null ? '–' : Math.round(after)}</span>
      {d !== null && d !== 0 && (
        <span className={cx('font-semibold', d > 0 ? 'text-pass' : 'text-bad')}>{d > 0 ? `+${d}` : d}</span>
      )}
    </span>
  );
}

export const btn = {
  base: 'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-[background-color,color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
  primary: 'bg-ink px-4 py-2.5 text-ink-fg shadow-xs hover:bg-ink-hover',
  secondary: 'border border-line bg-surface px-4 py-2.5 text-fg shadow-xs hover:border-line-strong hover:bg-surface-2',
  ghost: 'px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-fg',
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'sm',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; tip?: ReactNode }[];
  label: string;
  size?: 'sm' | 'xs';
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'num rounded-md font-medium whitespace-nowrap transition-colors',
            size === 'xs' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1 text-[13px]',
            value === o.value ? 'bg-surface text-fg shadow-xs ring-1 ring-line' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
