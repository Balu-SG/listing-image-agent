import { useId, useRef, useState, type DragEvent } from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import { ACCEPTED } from '../image';
import { cx } from '../lib';

export type UploadPhase = 'idle' | 'preparing' | 'uploading';

const PHASE_TEXT: Record<Exclude<UploadPhase, 'idle'>, string> = {
  preparing: 'Resizing image…',
  uploading: 'Inspecting 8 rules with OpenCV…',
};

export function Uploader({ phase, onFile, compact = false }: { phase: UploadPhase; onFile: (f: File) => void; compact?: boolean }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
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
          'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition-colors',
          'focus-within:border-accent focus-within:bg-accent-soft',
          compact ? 'px-4 py-6' : 'px-6 py-14 sm:py-20',
          over ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/60',
          busy && 'cursor-progress',
        )}
      >
        <span
          className={cx(
            'grid place-items-center rounded-full bg-accent-soft text-accent',
            compact ? 'size-10' : 'size-14',
            busy && 'animate-pulse-ring',
          )}
        >
          {busy ? <Loader2 aria-hidden className="size-6 animate-spin" /> : <ImageUp aria-hidden className="size-6" />}
        </span>
        {busy ? (
          <span className="font-medium" role="status">
            {PHASE_TEXT[phase]}
          </span>
        ) : (
          <>
            <span className={cx('font-semibold', compact ? 'text-base' : 'text-lg')}>
              Drop a main product image, or <span className="text-accent underline underline-offset-2">browse</span>
            </span>
            {!compact && (
              <span className="max-w-md text-sm text-muted">
                JPEG or PNG. We resize to 2000 px on the long side before upload, then check it against 8 Amazon
                main-image rules.
              </span>
            )}
          </>
        )}
        <input
          ref={inputRef}
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
      {localError && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {localError}
        </p>
      )}
    </div>
  );
}
