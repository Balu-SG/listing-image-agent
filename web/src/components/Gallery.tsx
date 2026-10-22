import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { api, assetUrl, friendlyError } from '../api';
import type { GalleryItem } from '../types';
import { ScoreDelta } from './Card';
import { STATUS_CHIP, scoreTone, cx } from '../lib';

export function Gallery({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .gallery()
      .then((g) => alive && setItems(g.items))
      .catch((e) => alive && setError(friendlyError(e)));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>;
  if (!items)
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-20 text-muted">
        <Loader2 aria-hidden className="size-5 animate-spin" /> Loading gallery…
      </div>
    );
  if (!items.length)
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-muted">
        <ImageOff aria-hidden className="size-6" />
        No results yet. Upload an image to get started.
      </div>
    );

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const final = item.score_after ?? item.score_before;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="group w-full overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-square bg-white">
                <img src={assetUrl(item.thumb_url)} alt={`Thumbnail of ${item.filename}`} loading="lazy" className="size-full object-contain" />
                <span className={cx('absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', STATUS_CHIP[scoreTone(final)])}>
                  {Math.round(final)}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium group-hover:text-accent">{item.filename}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <ScoreDelta before={item.score_before} after={item.score_after} />
                  <span className="text-muted capitalize">{item.state}</span>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
