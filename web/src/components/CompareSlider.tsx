import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from './Tooltip';

/**
 * Before/after comparison inside one square stage. Both images use object-contain in the
 * same frame; the "after" image is revealed to the right of the divider.
 */
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
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setPos((p) => Math.max(0, p - step));
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setPos((p) => Math.min(100, p + step));
    else if (e.key === 'Home') setPos(0);
    else if (e.key === 'End') setPos(100);
    else return;
    e.preventDefault();
  };

  const label = 'pointer-events-none absolute top-3 rounded-md border border-line bg-surface/90 px-2 py-0.5 text-[11.5px] font-medium text-fg shadow-xs backdrop-blur transition-opacity';

  return (
    <div
      ref={ref}
      className="absolute inset-0 touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      style={{ cursor: dragging ? 'grabbing' : 'ew-resize' }}
    >
      <img src={before} alt={`${beforeLabel} image`} className="absolute inset-0 size-full object-contain p-[4%]" draggable={false} />
      <div className="absolute inset-0 bg-stage" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <img src={after} alt={`${afterLabel} image`} className="absolute inset-0 size-full object-contain p-[4%]" draggable={false} />
      </div>
      <span className={label} style={{ left: 12, opacity: pos < 18 ? 0 : 1 }}>
        {beforeLabel}
      </span>
      <span className={label} style={{ right: 12, opacity: pos > 82 ? 0 : 1 }}>
        {afterLabel}
      </span>
      <div className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.25)]" style={{ left: `${pos}%` }} />
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos}%` }}>
        <Tooltip content="Drag to compare, or focus and use the arrow keys (Shift for bigger steps).">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Comparison divider. Left of it is the original, right of it the fixed image."
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={`${Math.round(pos)}% original`}
            onKeyDown={onKey}
            className="flex h-8 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-stone-700 shadow-[0_2px_8px_rgb(0_0_0/0.18)] transition-transform hover:scale-105 focus-visible:rounded-full"
          >
            <ChevronLeft aria-hidden className="-mr-0.5 size-4" strokeWidth={2.25} />
            <ChevronRight aria-hidden className="-ml-0.5 size-4" strokeWidth={2.25} />
          </div>
        </Tooltip>
      </div>
    </div>
  );
}
