import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

/** Before/after comparison: the "after" image is revealed to the right of a draggable divider. */
export function CompareSlider({ before, after, beforeLabel = 'Original', afterLabel = 'Fixed' }: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    moveTo(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) moveTo(e.clientX);
  };
  const stop = () => setDragging(false);

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - step));
    else if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + step));
    else if (e.key === 'Home') setPos(0);
    else if (e.key === 'End') setPos(100);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      className="checker relative aspect-square w-full touch-none overflow-hidden rounded-xl border border-line select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      style={{ cursor: dragging ? 'grabbing' : 'ew-resize' }}
    >
      <img src={before} alt={`${beforeLabel} image`} className="absolute inset-0 size-full object-contain" draggable={false} />
      <img
        src={after}
        alt={`${afterLabel} image`}
        className="absolute inset-0 size-full object-contain"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
        draggable={false}
      />
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg">
        {afterLabel}
      </span>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -translate-x-1/2 border-l-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25),0_0_12px_rgba(0,0,0,0.35)]" />
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Comparison divider: left shows original, right shows fixed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}% original`}
        onKeyDown={onKey}
        className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-accent text-accent-fg shadow-lg transition-transform focus-visible:scale-110"
        style={{ left: `${pos}%` }}
      >
        <ChevronsLeftRight aria-hidden className="size-5" />
      </div>
    </div>
  );
}
