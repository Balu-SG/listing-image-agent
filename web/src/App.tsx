import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { api, friendlyError } from './api';
import { prepareImage } from './image';
import type { Result } from './types';
import { Header, type Route } from './components/Header';
import { Footer } from './components/Footer';
import { type UploadPhase } from './components/Uploader';
import { ResultSkeleton, ResultView } from './components/ResultView';
import { Gallery } from './components/Gallery';
import { Home } from './components/Home';

const POLL_MS = 1500;

type Location = { route: Route; id: string | null };

function readHash(): Location {
  const h = window.location.hash;
  if (h.startsWith('#/gallery')) return { route: 'gallery', id: null };
  const m = h.match(/^#\/results\/(.+)$/);
  return { route: 'inspect', id: m ? decodeURIComponent(m[1]) : null };
}

function hashFor(loc: Location): string {
  if (loc.route === 'gallery') return '#/gallery';
  return loc.id ? `#/results/${encodeURIComponent(loc.id)}` : '#/';
}

export default function App() {
  const [loc, setLoc] = useState<Location>(readHash);
  const [result, setResult] = useState<Result | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [fixing, setFixing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentId = useRef<string | null>(null);

  const navigate = useCallback((next: Location) => {
    const h = hashFor(next);
    if (window.location.hash !== h) window.location.hash = h;
    setLoc(next);
    window.scrollTo({ top: 0 });
  }, []);

  // Browser back / forward and manual hash edits.
  useEffect(() => {
    const onHash = () => setLoc(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Load the result named in the URL when it is not the one on screen.
  useEffect(() => {
    if (loc.route !== 'inspect') return;
    if (!loc.id) {
      currentId.current = null;
      setResult(null);
      setFixing(false);
      return;
    }
    if (result?.id === loc.id) return;
    const id = loc.id;
    currentId.current = id;
    setResult(null);
    setFixing(false);
    setError(null);
    setLoading(true);
    api
      .result(id)
      .then((r) => currentId.current === id && setResult(r))
      .catch((e) => currentId.current === id && setError(friendlyError(e)))
      .finally(() => currentId.current === id && setLoading(false));
  }, [loc]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const r = await api.analyze(base64, name);
      currentId.current = r.id;
      setResult(r);
      navigate({ route: 'inspect', id: r.id });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPhase('idle');
    }
  };

  const onUrl = async (url: string) => {
    setError(null);
    setFixing(false);
    try {
      setPhase('fetching');
      const r = await api.analyzeUrl(url);
      currentId.current = r.id;
      setResult(r);
      navigate({ route: 'inspect', id: r.id });
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
      setResult((r) => (r && r.id === result.id ? { ...r, state: 'running', steps: [], error: null } : r));
    } catch (e) {
      setError(friendlyError(e));
      setFixing(false);
    }
  };

  const goHome = () => {
    setError(null);
    navigate({ route: 'inspect', id: null });
  };
  const open = (id: string) => {
    setError(null);
    navigate({ route: 'inspect', id });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Header route={loc.route} onNavigate={(r) => (r === 'gallery' ? navigate({ route: 'gallery', id: null }) : goHome())} />
      <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-[13.5px] text-bad">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="rounded p-0.5 hover:bg-bad/10">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )}

        {loc.route === 'gallery' ? (
          <Gallery onOpen={open} />
        ) : loc.id ? (
          result && result.id === loc.id ? (
            <ResultView result={result} fixing={fixing} onFix={onFix} onReset={goHome} />
          ) : loading ? (
            <ResultSkeleton />
          ) : (
            <div className="py-16 text-center">
              <button type="button" onClick={goHome} className="text-sm font-medium text-accent hover:underline">
                Inspect a new image
              </button>
            </div>
          )
        ) : (
          <Home phase={phase} onFile={onFile} onUrl={onUrl} onOpen={open} onGallery={() => navigate({ route: 'gallery', id: null })} />
        )}
      </main>
      <Footer />
    </div>
  );
}
