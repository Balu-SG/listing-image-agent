import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cx } from '../lib';

type Side = 'top' | 'bottom';
const GAP = 8;
const MARGIN = 10;

/**
 * One accessible tooltip for the whole app.
 * - Opens on mouse hover (short delay), keyboard focus (focus-visible) and tap on touch.
 * - Escape or a tap elsewhere closes it.
 * - Rendered in a portal with fixed positioning, flipped and clamped to stay inside the viewport.
 * - The trigger element gets aria-describedby pointing at the tooltip.
 */
export function Tooltip({
  content,
  title,
  children,
  side = 'top',
  className,
  wide = false,
}: {
  content: ReactNode;
  title?: ReactNode;
  children: ReactElement;
  side?: Side;
  className?: string;
  wide?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; side: Side } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const empty = content === null || content === undefined || content === '';

  const show = useCallback((delay = 0) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  }, []);
  const hide = useCallback((delay = 0) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), delay);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const place = useCallback(() => {
    const a = anchor.current;
    const t = tip.current;
    if (!a || !t) return;
    const r = a.getBoundingClientRect();
    const tw = t.offsetWidth;
    const th = t.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let s: Side = side;
    if (s === 'top' && r.top - th - GAP < MARGIN) s = 'bottom';
    else if (s === 'bottom' && r.bottom + th + GAP > vh - MARGIN && r.top - th - GAP > MARGIN) s = 'top';
    const y = s === 'top' ? r.top - th - GAP : r.bottom + GAP;
    const x = Math.min(Math.max(MARGIN, r.left + r.width / 2 - tw / 2), vw - tw - MARGIN);
    setPos({ x, y, side: s });
  }, [side]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (anchor.current && !anchor.current.contains(e.target as Node)) setOpen(false);
    };
    const onMove = () => place();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, place]);

  if (empty) return children;

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': open ? id : undefined })
    : children;

  return (
    <span
      ref={anchor}
      className={cx('inline-flex max-w-full', className)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show(140)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide(60)}
      onPointerUp={(e) => {
        if (e.pointerType !== 'mouse') setOpen((o) => !o);
      }}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches?.(':focus-visible')) show(0);
      }}
      onBlur={() => hide(0)}
    >
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            className={cx(
              'pointer-events-none fixed z-50 rounded-lg bg-tip-bg px-3 py-2 text-left text-[12.5px] leading-snug font-normal text-tip-fg shadow-pop',
              wide ? 'w-[min(20rem,calc(100vw-20px))]' : 'max-w-[min(17rem,calc(100vw-20px))]',
              pos ? 'animate-tip-in' : 'invisible',
            )}
            style={{
              left: pos?.x ?? 0,
              top: pos?.y ?? 0,
              ['--tip-dy' as string]: pos?.side === 'bottom' ? '-3px' : '3px',
            }}
          >
            {title && <div className="mb-1 text-[13px] font-semibold text-tip-fg">{title}</div>}
            <div className="text-tip-fg/90">{content}</div>
          </div>,
          document.body,
        )}
    </span>
  );
}

/** A labelled section inside a rich tooltip: "Why  Amazon requires ..." */
export function TipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-1.5 first:mt-0">
      <div className="text-[10.5px] font-semibold tracking-wider text-tip-muted uppercase">{label}</div>
      <div>{children}</div>
    </div>
  );
}

/** Small circular "i" trigger for inline help. */
export function InfoTip({
  label,
  title,
  content,
  wide,
  side,
  className,
}: {
  label: string;
  title?: ReactNode;
  content: ReactNode;
  wide?: boolean;
  side?: Side;
  className?: string;
}) {
  if (content === null || content === undefined || content === '') return null;
  return (
    <Tooltip content={content} title={title} wide={wide} side={side}>
      <button
        type="button"
        aria-label={label}
        className={cx(
          'inline-grid size-5 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-fg',
          className,
        )}
      >
        <Info aria-hidden className="size-3.5" strokeWidth={2} />
      </button>
    </Tooltip>
  );
}
