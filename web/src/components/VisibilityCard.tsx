import { useState } from 'react';
import { Eye } from 'lucide-react';
import type { Visibility } from '../types';
import { assetUrl } from '../api';
import { Card, ScoreDelta } from './Card';
import { cx } from '../lib';

type View = 'grid' | 'saliency';

export function VisibilityCard({ before, after }: { before: Visibility; after: Visibility | null }) {
  const [which, setWhich] = useState<'before' | 'after'>(after ? 'after' : 'before');
  const v = which === 'after' && after ? after : before;
  const views: { key: View; label: string; src: string | undefined; alt: string }[] = [
    { key: 'grid', label: 'Search grid', src: assetUrl(v.grid_url), alt: 'Your product as a search thumbnail, centred among 8 neighbouring products' },
    { key: 'saliency', label: 'Saliency heat map', src: assetUrl(v.saliency_url), alt: 'Saliency heat map of the search grid; brighter areas draw more attention' },
  ];
  return (
    <Card
      title="Search visibility"
      icon={<Eye aria-hidden className="size-5" />}
      action={
        <div className="text-sm">
          <ScoreDelta before={before.score} after={after?.score ?? null} />
        </div>
      }
    >
      <p className="mb-4 text-sm text-muted">
        How much your thumbnail stands out among 8 neighbours in search results. 50 is average for the grid.
      </p>
      {after && (
        <div role="tablist" aria-label="Visibility version" className="mb-3 inline-flex rounded-lg bg-surface-2 p-1 text-sm">
          {(['before', 'after'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={which === k}
              onClick={() => setWhich(k)}
              className={cx('rounded-md px-3 py-1 font-medium capitalize', which === k ? 'bg-surface shadow-sm' : 'text-muted hover:text-fg')}
            >
              {k} · {Math.round((k === 'after' ? after : before).score)}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {views.map((view) => (
          <figure key={view.key} className="min-w-0">
            {view.src ? (
              <img src={view.src} alt={view.alt} className="aspect-square w-full rounded-xl border border-line bg-surface-2 object-cover" />
            ) : (
              <div className="aspect-square w-full rounded-xl bg-surface-2" />
            )}
            <figcaption className="mt-1.5 text-xs text-muted">{view.label}</figcaption>
          </figure>
        ))}
      </div>
    </Card>
  );
}
