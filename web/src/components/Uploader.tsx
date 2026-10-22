import { useId, useState, type DragEvent } from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import { ACCEPTED } from '../image';
import { cx } from '../lib';
import { btn } from './Card';

export type UploadPhase = 'idle' | 'preparing' | 'fetching' | 'uploading';

const PHASE_TEXT: Record<Exclude<UploadPhase, 'idle'>, [string, string]> = {
  preparing: ['Preparing image', 'Resizing to 2000 px on the long side.'],
  fetching: ['Fetching image', 'Downloading the linked image, then checking 8 Amazon main-image rules.'],
  uploading: ['Inspecting', 'Checking 8 Amazon main-image rules with OpenCV.'],
};

export function Uploader({
  phase,
  onFile,
  onUrl,
}: {
  phase: UploadPhase;
  onFile: (f: File) => void;
  onUrl: (url: string) => void;
}) {
  const inputId = useId();
  const urlId = useId();
  const urlHelpId = useId();
  const [url, setUrl] = useState('');
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = phase !== 'idle';

  const take = (file: File | undefined) => {
    if (!file || busy) return;
    if (!ACCEPTED.includes(file.type)) {
      setLocalError('Please choose a JPEG or PNG image.');
      return;
    }
    setLocalError(null);
    onFile(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        aria-busy={busy}
        className={cx(
          'group relative block cursor-pointer overflow-hidden rounded-xl border bg-surface p-1.5 shadow-xs transition-colors',
          'focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15',
          over ? 'border-accent ring-3 ring-accent/15' : 'border-line hover:border-line-strong',
          busy && 'cursor-progress',
        )}
      >
        <div
          className={cx(
            'flex flex-col items-center justify-center gap-4 rounded-lg px-6 py-10 text-center transition-colors sm:flex-row sm:gap-5 sm:py-9 sm:text-left',
            over ? 'bg-accent-soft' : 'bg-surface-2/70',
          )}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted shadow-xs">
            {busy ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <ImageUp aria-hidden className="size-5" strokeWidth={1.75} />}
          </span>
          {busy ? (
            <span className="flex-1" role="status">
              <span className="block text-[15px] font-semibold">{PHASE_TEXT[phase][0]}…</span>
              <span className="mt-0.5 block text-sm text-muted">{PHASE_TEXT[phase][1]}</span>
            </span>
          ) : (
            <>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">{over ? 'Drop to inspect' : 'Drop a main product image'}</span>
                <span className="mt-0.5 block text-sm text-muted">JPEG or PNG. Resized to 2000 px before upload.</span>
              </span>
              <span className={cx(btn.base, btn.primary, 'pointer-events-none')}>Choose image</span>
            </>
          )}
        </div>
        {busy && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-surface-3">
            <span className="animate-indeterminate block h-full w-2/5 bg-ink" />
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED.join(',')}
          className="sr-only"
          disabled={busy}
          aria-label="Upload product image"
          onChange={(e) => {
            take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          const link = url.trim();
          if (busy || !link) return;
          if (!link.startsWith('https://')) {
            setLocalError('Paste an https:// image link.');
            return;
          }
          setLocalError(null);
          onUrl(link);
        }}
      >
        <label htmlFor={urlId} className="shrink-0 text-[13px] text-muted">
          or paste an image link
        </label>
        <div className="flex min-w-0 flex-1 gap-2">
          <input
            id={urlId}
            type="url"
            inputMode="url"
            placeholder="https://m.media-amazon.com/images/I/….jpg"
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
            aria-describedby={urlHelpId}
            className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 font-mono text-[12.5px] placeholder:text-subtle focus:border-accent focus:ring-3 focus:ring-accent/15 focus:outline-none disabled:opacity-60"
          />
          <button type="submit" disabled={busy || !url.trim()} className={cx(btn.base, btn.secondary, 'h-9 shrink-0')}>
            Inspect link
          </button>
        </div>
      </form>
      <p id={urlHelpId} className="mt-1.5 text-[12px] text-subtle sm:text-right">
        Use the image’s own address (right-click the image → Copy image address), not the product page. https only,
        JPEG/PNG/WebP up to 4.5 MB.
      </p>
      {localError && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {localError}
        </p>
      )}
    </div>
  );
}
