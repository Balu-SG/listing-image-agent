import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { api, assetUrl, friendlyError } from '../api';
import type { GalleryItem } from '../types';
import { ScoreDelta } from './Card';
import { StatusChip } from './StatusChip';
import { cx, GALLERY_STATUS_LABEL, galleryStatus } from '../lib';

export function useGallery() {
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
  return { items, error };
}

export function GalleryCard({ item, onOpen, compact = false }: { item: GalleryItem; onOpen: (id: string) => void; compact?: boolean }) {
  const status = galleryStatus(item);
  const original = assetUrl(item.original_thumb_url ?? item.thumb_url);
  const fixed = item.state === 'done' && item.original_thumb_url ? assetUrl(item.thumb_url) : undefined;
  const reshoot = item.needs_reshoot_count ?? 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-label={`Open result for ${item.filename}`}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-line bg-surface text-left shadow-xs transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop focus-visible:rounded-xl"
    >
      <div className="relative aspect-square overflow-hidden border-b border-line bg-stage">
        <img
          src={original}
          alt={compact ? `Original image ${item.filename}` : `Original upload ${item.filename}`}
          className={cx('absolute inset-0 size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]', compact ? 'p-2' : 'p-4')}
        />
        {!compact && fixed && (
          <figure className="absolute right-2.5 bottom-2.5 w-[30%] overflow-hidden rounded-md border border-line bg-surface shadow-pop">
            <img src={fixed} alt={`Fixed image ${item.filename}`} loading="lazy" className="aspect-square w-full bg-white object-contain p-1" />
            <figcaption className="border-t border-line px-1.5 py-0.5 text-center text-[10.5px] font-medium text-muted">Fixed</figcaption>
          </figure>
        )}
      </div>
      <div className={cx('flex flex-col gap-1.5', compact ? 'px-2.5 py-2' : 'px-3.5 py-3')}>
        {!compact && (
          <p className="truncate font-mono text-[12px] text-muted" title={item.filename}>
            {item.filename}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {compact ? (
            <span className="num w-full text-center text-[12px] text-subtle">
              Score <span className="font-semibold text-fg">{item.score_before}</span>
            </span>
          ) : (
            <ScoreDelta before={item.score_before} after={item.score_after} />
          )}
          {!compact && status && (
            <StatusChip
              status={status}
              label={GALLERY_STATUS_LABEL[status]}
              tipTitle={GALLERY_STATUS_LABEL[status]}
              tipContent={
                status === 'PASS'
                  ? 'Every rule passes after the fix.'
                  : `${reshoot === 1 ? '1 issue' : `${reshoot} issues`} still need${reshoot === 1 ? 's' : ''} attention: a new photo or a person.`
              }
            />
          )}
          {!compact && !status && <span className="text-xs text-subtle capitalize">{item.state}</span>}
        </div>
      </div>
    </button>
  );
}

export function GallerySkeleton({ count = 8, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} aria-hidden className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="skeleton aspect-square rounded-none" />
          <div className={cx('space-y-2', compact ? 'p-2.5' : 'p-3.5')}>
            {!compact && <div className="skeleton h-3 w-3/4" />}
            <div className="skeleton h-3 w-1/3" />
          </div>
        </li>
      ))}
    </>
  );
}

export function Gallery({ onOpen }: { onOpen: (id: string) => void }) {
  const { items, error } = useGallery();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Gallery</h1>
          <p className="mt-1 text-sm text-muted">Recent inspections. Open one to see the fixes, the proof and the visibility score.</p>
        </div>
        {items && items.length > 0 && <p className="num text-sm text-subtle">{items.length} results</p>}
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </p>
      ) : items && !items.length ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface py-20 text-sm text-muted">
          <ImageOff aria-hidden className="size-5" />
          No results yet. Inspect an image to get started.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" aria-busy={!items}>
          {!items ? (
            <GallerySkeleton />
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <GalleryCard item={item} onOpen={onOpen} />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
