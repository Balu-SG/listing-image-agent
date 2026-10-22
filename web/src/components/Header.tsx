import { useEffect, useState } from 'react';
import { Sparkles, Cpu, ScanSearch } from 'lucide-react';
import { api, MOCK } from '../api';
import type { Health } from '../types';
import { cx } from '../lib';

export function Header() {
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
  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg">
            <ScanSearch aria-hidden className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg leading-tight font-semibold">Listing Image Compliance Agent</h1>
            <p className="text-sm text-muted">Compliant listing images, product untouched.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {MOCK && (
            <span className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs font-medium text-muted">
              Mock data
            </span>
          )}
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
              down ? 'border-bad/40 text-bad' : 'border-line text-fg',
            )}
            title={health?.model ?? undefined}
          >
            {down ? (
              'API offline'
            ) : !health ? (
              <span className="text-muted">Checking planner…</span>
            ) : (
              <>
                {claude ? <Sparkles aria-hidden className="size-3.5 text-accent" /> : <Cpu aria-hidden className="size-3.5 text-muted" />}
                <span className="sr-only">Planner:</span>
                {claude ? 'Claude on Bedrock' : 'Rule planner'}
              </>
            )}
          </span>
        </div>
      </div>
    </header>
  );
}
