import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Result } from '../types';
import { assetUrl } from '../api';
import { cx } from '../lib';
import { useMeta } from '../meta';
import { DownloadFixed } from './DownloadFixed';
import { CompareSlider } from './CompareSlider';
import { Tooltip } from './Tooltip';
import { btn } from './Card';

/** Used only if /api/meta is unavailable; the real colours come from meta.overlay_legend. */
const LEGEND_FALLBACK = [
  { colour: '#1478d2', label: 'Protected product outline' },
  { colour: '#eb9600', label: 'To change' },
  { colour: '#dc2626', label: 'To remove or reshoot' },
];

type View = 'compare' | 'original' | 'overlay' | 'fixed' | 'fixed_overlay';

const VIEW_TIP: Record<View, string> = {
  compare: 'Original and fixed image in the same frame. Drag the divider to compare.',
  original: 'The image as uploaded (resized to 2000 px on the long side).',
  overlay: 'The original with the checks drawn on it: the protected product outline, backdrop to whiten, and anything to remove.',
  fixed: 'The fixed image, ready to upload as your main image.',
  fixed_overlay: 'The fixed image with the rule checks drawn on it.',
};

export function ImageViewer({ result }: { result: Result }) {
  const meta = useMeta();
  const { images, before, after } = result;
  const hasFixed = result.state === 'done' && !!images.fixed;
  const [view, setView] = useState<View>(hasFixed ? 'compare' : 'original');

  useEffect(() => {
    setView(hasFixed ? 'compare' : 'original');
  }, [result.id, hasFixed]);

  const views: { key: View; label: string }[] = [
    ...(hasFixed ? [{ key: 'compare' as const, label: 'Compare' }] : []),
    { key: 'original', label: 'Original' },
    { key: 'overlay', label: 'Issues' },
    ...(hasFixed ? [{ key: 'fixed' as const, label: 'Fixed' }] : []),
    ...(hasFixed && images.fixed_overlay ? [{ key: 'fixed_overlay' as const, label: 'Fixed checks' }] : []),
  ];

  const src: Record<View, string | null> = {
    compare: images.fixed,
    original: images.original,
    overlay: images.overlay,
    fixed: images.fixed,
    fixed_overlay: images.fixed_overlay,
  };
  const current = assetUrl(src[view]);
  const alt: Record<View, string> = {
    compare: '',
    original: `Uploaded product image ${result.filename}`,
    overlay: 'Product image with rule violations highlighted',
    fixed: 'Fixed product image',
    fixed_overlay: 'Fixed product image with rule checks drawn on it',
  };

  const sizeChanged = after && (after.width !== before.width || after.height !== before.height);
  const scene = result.before.rules.find((r) => r.rule_id === 'R1')?.evidence?.mode === 'scene';

  return (
    <section aria-label="Image viewer" className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 sm:px-5">
        <div className="min-w-0">
          <h1 className="truncate font-mono text-[13px] font-medium" title={result.filename}>
            {result.filename}
          </h1>
          <p className="num mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
            <span>
              {before.width} × {before.height}
              {sizeChanged && (
                <>
                  <span aria-hidden> → </span>
                  <span className="sr-only"> resized to </span>
                  <span className="text-muted">
                    {after.width} × {after.height}
                  </span>
                </>
              )}{' '}
              px
            </span>
            <span aria-hidden>·</span>
            <Tooltip
              title={scene ? 'Scene photo' : 'Studio photo'}
              content={scene ? (meta?.metrics.segmentation.scene ?? 'Lifestyle photo: nothing is edited.') : (meta?.metrics.segmentation.studio ?? 'Plain backdrop: the product outline is reliable.')}
            >
              <button type="button" className={cx('underline decoration-dotted underline-offset-2', scene ? 'text-bad' : '')}>
                {scene ? 'Scene photo' : 'Studio backdrop'}
              </button>
            </Tooltip>
          </p>
        </div>
        <div role="tablist" aria-label="Image view" className="flex w-full max-w-full overflow-x-auto sm:w-auto">
          <div className="flex w-full rounded-lg border border-line bg-surface-2 p-0.5 sm:inline-flex sm:w-auto">
            {views.map((v) => (
              <Tooltip key={v.key} content={VIEW_TIP[v.key]} side="bottom" className="flex-1 sm:flex-none">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === v.key}
                  onClick={() => setView(v.key)}
                  className={cx(
                    'w-full rounded-md px-1.5 py-1 text-xs font-medium whitespace-nowrap transition-colors sm:px-2.5 sm:text-[12.5px]',
                    view === v.key ? 'bg-surface text-fg shadow-xs ring-1 ring-line' : 'text-muted hover:text-fg',
                  )}
                >
                  {v.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      </header>

      <div className="relative aspect-square w-full bg-stage">
        {view === 'compare' && hasFixed ? (
          <CompareSlider before={assetUrl(images.original)!} after={assetUrl(images.fixed)!} />
        ) : current ? (
          <img key={current} src={current} alt={alt[view]} className="absolute inset-0 size-full object-contain p-[4%]" />
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 sm:px-5">
        {view === 'overlay' || view === 'fixed_overlay' ? (
          <ul aria-label="Overlay legend" className="flex w-full flex-col gap-1 text-xs text-muted">
            {(meta?.overlay_legend ?? LEGEND_FALLBACK).map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: l.colour }} /> {l.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-subtle">{view === 'compare' ? 'Left: original · Right: fixed' : views.find((v) => v.key === view)?.label}</p>
        )}
        <div className="ml-auto flex items-center gap-1">
          {current && (
            <Tooltip content="Open this view at full resolution in a new tab.">
              <a href={current} target="_blank" rel="noreferrer" className={cx(btn.base, btn.ghost, 'text-[13px]')}>
                <ExternalLink aria-hidden className="size-3.5" /> Open full size
              </a>
            </Tooltip>
          )}
          {hasFixed && <DownloadFixed result={result} className={cx(btn.base, btn.ghost, 'text-[13px]')} iconClassName="size-3.5" />}
        </div>
      </footer>
    </section>
  );
}
