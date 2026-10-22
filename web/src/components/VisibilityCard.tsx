import { useState } from 'react';
import type { Visibility } from '../types';
import { assetUrl } from '../api';
import { useMeta } from '../meta';
import { Panel, ScoreDelta, Segmented } from './Card';
import { InfoTip } from './Tooltip';

export function VisibilityCard({ before, after }: { before: Visibility; after: Visibility | null }) {
  const meta = useMeta();
  const [which, setWhich] = useState<'before' | 'after'>(after ? 'after' : 'before');
  const v = which === 'after' && after ? after : before;
  const help = meta?.metrics.visibility ?? 'How much your thumbnail stands out among 8 neighbours in search. 50 is average.';

  const figures = [
    {
      key: 'grid',
      label: 'Search grid',
      tip: 'Your image as a search thumbnail, in the centre of 8 other products.',
      src: assetUrl(v.grid_url),
      alt: 'Your product as a search thumbnail, centred among 8 neighbouring products',
    },
    {
      key: 'heat',
      label: 'Attention heat map',
      tip: 'Spectral-residual saliency of the grid: brighter areas draw the eye first. Your image is outlined in the centre.',
      src: assetUrl(v.saliency_url),
      alt: 'Saliency heat map of the search grid; brighter areas draw more attention',
    },
  ];

  const pct = Math.max(0, Math.min(100, v.score));
  const scoreBlock = (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">
          {v.score >= 50 ? 'Draws more than its share of attention' : 'Draws less than its share of attention'}
        </p>
        <span className="num shrink-0 font-mono text-xs text-subtle">{Math.round(v.score)} / 100</span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-surface-3" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
        <div className="absolute -top-1 -bottom-1 left-1/2 w-px bg-line-strong" />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-subtle" aria-hidden>
        <span>0</span>
        <span>50 = average</span>
        <span>100</span>
      </div>
    </div>
  );

  return (
    <Panel
      title="Search visibility"
      help={<InfoTip label="About search visibility" title="Search visibility" content={help} wide />}
      action={after ? <ScoreDelta before={before.score} after={after.score} size="md" /> : undefined}
      className="flex h-full flex-col"
      bodyClassName="flex-1"
    >
      {after && (
        <div className="mb-4">
          <Segmented
            label="Visibility version"
            value={which}
            onChange={setWhich}
            size="xs"
            options={[
              { value: 'before', label: `Before · ${Math.round(before.score)}` },
              { value: 'after', label: `After · ${Math.round(after.score)}` },
            ]}
          />
        </div>
      )}
      {scoreBlock}
      <div className="grid grid-cols-2 gap-3">
        {figures.map((f) => (
          <figure key={f.key} className="min-w-0">
            <div className="aspect-square overflow-hidden rounded-lg border border-line bg-stage">
              {f.src && <img src={f.src} alt={f.alt} className="size-full object-cover" />}
            </div>
            <figcaption className="mt-2 flex items-center gap-1 text-xs text-subtle">
              {f.label}
              <InfoTip label={`About the ${f.label.toLowerCase()}`} content={f.tip} />
            </figcaption>
          </figure>
        ))}
      </div>
    </Panel>
  );
}
