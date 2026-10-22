import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, LayoutGrid, ScanSearch, X } from 'lucide-react';
import { api, friendlyError } from './api';
import { prepareImage } from './image';
import type { Result } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Uploader, type UploadPhase } from './components/Uploader';
import { ResultView } from './components/ResultView';
import { Gallery } from './components/Gallery';
import { cx } from './lib';

const POLL_MS = 1500;
type Tab = 'inspect' | 'gallery';

function readHash(): { tab: Tab; id: string | null } {
  const h = window.location.hash;
  if (h.startsWith('#/gallery')) return { tab: 'gallery', id: null };
  const m = h.match(/^#\/results\/(.+)$/);
  return { tab: 'inspect', id: m ? decodeURIComponent(m[1]) : null };
}

function writeHash(hash: string) {
  if (window.location.hash !== hash) history.replaceState(null, '', hash || window.location.pathname + window.location.search);
}

export default function App() {
  const [tab, setTab] = useState<Tab>(() => readHash().tab);
  const [result, setResult] = useState<Result | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [fixing, setFixing] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentId = useRef<string | null>(null);

  const show = useCallback((r: Result) => {
    currentId.current = r.id;
    setResult(r);
  }, []);

  const open = useCallback(
    async (id: string) => {
      setTab('inspect');
      setError(null);
      setFixing(false);
      setLoadingId(id);
      currentId.current = id;
      try {
        show(await api.result(id));
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setLoadingId(null);
      }
    },
    [show],
  );

  // Deep link: #/results/<id>
  useEffect(() => {
    const { id } = readHash();
    if (id) void open(id);
  }, [open]);

  useEffect(() => {
    if (tab === 'gallery') writeHash('#/gallery');
    else writeHash(result ? `#/results/${encodeURIComponent(result.id)}` : '');
  }, [tab, result?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while the agent is running.
  const shouldPoll = !!result && (result.state === 'running' || (fixing && result.state === 'analyzed'));
  useEffect(() => {
    if (!shouldPoll || !result) return;
    const id = result.id;
    const t = window.setTimeout(async () => {
      try {
        const next = await api.result(id);
        if (currentId.current !== id) return;
        setResult(next);
        if (next.state === 'done' || next.state === 'error') setFixing(false);
      } catch (e) {
        if (currentId.current !== id) return;
        setError(friendlyError(e));
        setFixing(false);
      }
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [shouldPoll, result]);

  const onFile = async (file: File) => {
    setError(null);
    setFixing(false);
    try {
      setPhase('preparing');
      const { base64 } = await prepareImage(file);
      setPhase('uploading');
      const name = file.name.replace(/\.(png|jpe?g)$/i, '') + '.jpg';
      show(await api.analyze(base64, name));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPhase('idle');
    }
  };

  const onFix = async () => {
    if (!result) return;
    setError(null);
    setFixing(true);
    try {
      await api.fix(result.id);
      // Reflect the running state immediately; the poller takes it from here.
      setResult((r) => (r && r.id === result.id ? { ...r, state: 'running', steps: [], error: null } : r));
    } catch (e) {
      setError(friendlyError(e));
      setFixing(false);
    }
  };

  const reset = () => {
    currentId.current = null;
    setResult(null);
    setFixing(false);
    setError(null);
  };

  const tabs: { key: Tab; label: string; icon: typeof ScanSearch }[] = [
    { key: 'inspect', label: 'Inspect', icon: ScanSearch },
    { key: 'gallery', label: 'Gallery', icon: LayoutGrid },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav role="tablist" aria-label="Sections" className="inline-flex rounded-xl border border-line bg-surface p-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cx(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                  tab === key ? 'bg-accent text-accent-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </button>
            ))}
          </nav>
          {tab === 'inspect' && result && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
            >
              <ArrowLeft aria-hidden className="size-4" /> Inspect another image
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="rounded p-0.5 hover:bg-bad/10">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )}

        {tab === 'gallery' ? (
          <Gallery onOpen={open} />
        ) : loadingId && !result ? (
          <p role="status" className="py-20 text-center text-muted">
            Loading result…
          </p>
        ) : result ? (
          <ResultView result={result} fixing={fixing} onFix={onFix} />
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Is your main image Amazon-ready?</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted">
                OpenCV checks 8 main-image rules and scores the photo. The agent then fixes what it can, and proves
                the product pixels were never touched.
              </p>
            </div>
            <Uploader phase={phase} onFile={onFile} />
            <ul className="mt-6 grid grid-cols-2 gap-2 text-sm text-muted sm:grid-cols-4">
              {['White background', 'Fill ≥ 85%', 'Resolution', 'No text or badges', 'No border', 'Sharpness', 'Centred, not cut off', 'Exposure'].map((r, i) => (
                <li key={r} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                  <span className="font-mono text-xs text-accent">R{i + 1}</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
