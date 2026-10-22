import { useEffect, useState } from 'react';
import { api, MOCK } from '../api';
import type { Health } from '../types';
import { cx } from '../lib';
import { useMeta } from '../meta';
import { Tooltip } from './Tooltip';

export type Route = 'inspect' | 'gallery';

export function Logo({ className }: { className?: string }) {
  // A framed square with a check: inspection of a square main image.
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--c-ink)" />
      <path d="M9 9h4M9 9v4M23 9h-4M23 9v4M9 23h4M9 23v-4M23 23h-4M23 23v-4" stroke="var(--c-ink-fg)" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      <path d="M11.5 16.3l3 3 6-6.3" stroke="var(--c-ink-fg)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Header({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }) {
  const meta = useMeta();
  const [health, setHealth] = useState<Health | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((h) => alive && setHealth(h))
      .catch(() => alive && setDown(true));
    return () => {
      alive = false;
    };
  }, []);

  const claude = health?.planner === 'claude';
  const plannerTip = down
    ? 'The inspection service is not responding.'
    : !health
      ? 'Checking which planner is active.'
      : claude
        ? (meta?.metrics.planner.claude ?? 'Claude on Amazon Bedrock plans which tools to run.') + (health.model ? ` Model: ${health.model}.` : '')
        : (meta?.metrics.planner.rules ?? 'A fixed rule-based planner chooses the tools.');

  const nav: { key: Route; label: string; href: string }[] = [
    { key: 'inspect', label: 'Inspect', href: '#/' },
    { key: 'gallery', label: 'Gallery', href: '#/gallery' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <a href="#/" onClick={(e) => { e.preventDefault(); onNavigate('inspect'); }} className="flex min-w-0 items-center gap-2.5" aria-label="Listing Image Compliance Agent, home">
          <Logo className="size-7 shrink-0" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">
              <span className="sm:hidden">Compliance Agent</span>
              <span className="hidden sm:inline">Listing Image Compliance Agent</span>
            </span>
            <span className="hidden truncate text-xs text-subtle lg:block">Compliant listing images, product untouched.</span>
          </span>
        </a>

        <nav aria-label="Main" className="flex items-center gap-0.5">
          {nav.map((n) => (
            <a
              key={n.key}
              href={n.href}
              aria-current={route === n.key ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(n.key);
              }}
              className={cx(
                'rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors',
                route === n.key ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {MOCK && (
            <span className="hidden rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-subtle sm:inline">MOCK</span>
          )}
          <Tooltip title={down ? 'Service offline' : 'Planner'} content={plannerTip} side="bottom">
            <button
              type="button"
              className={cx(
                'inline-flex min-h-7 min-w-7 items-center justify-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium max-[480px]:px-0',
                down ? 'border-bad-line text-bad' : 'border-line bg-surface text-fg',
              )}
            >
              <span
                aria-hidden
                className={cx('size-1.5 rounded-full', down ? 'bg-bad' : !health ? 'bg-line-strong' : claude ? 'bg-accent' : 'bg-subtle')}
              />
              <span className="sr-only">Planner: </span>
              <span className="max-[480px]:hidden">{down ? 'Offline' : !health ? 'Connecting' : claude ? 'Claude on Bedrock' : 'Rule planner'}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
