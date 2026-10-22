import { useEffect, useMemo, useRef, useState } from 'react';
import type { Body } from '../../engine/types';
import { Silhouette } from './Silhouette';

// Ad photos load straight from the listing CDN (no referrer). Haraj photos are kept as "h:<path>":
// the gallery shows the site's own 700px webp, the full-screen viewer the original. When a phone's network
// can't reach the CDN, the photo falls back to the original, then to our own relay, before it's dropped.
export function photoSrc(u: string, full = false): string {
  if (u.startsWith('h:')) {
    const path = u.slice(2);
    return full ? `https://mimg6cdn.haraj.com.sa/${path}` : `https://postcdn.haraj.com.sa/${path}-700.webp`;
  }
  return u;
}

/** The ways one photo can be fetched, lightest first. */
function sourcesOf(u: string, full = false): string[] {
  const light = photoSrc(u, full);
  const orig = photoSrc(u, true);
  const out = [light];
  if (orig !== light) out.push(orig);
  if (/haraj\.com\.sa\//.test(orig)) out.push(`/api/img?u=${encodeURIComponent(orig)}`);
  return out;
}

/** One photo that walks its fallback chain on error and fades in when it's ready (no black frames). */
export function Photo({ u, full, eager, className, onDead }: { u: string; full?: boolean; eager?: boolean; className: string; onDead: () => void }) {
  const srcs = useMemo(() => sourcesOf(u, full), [u, full]);
  const [k, setK] = useState(0);
  const [ok, setOk] = useState(false);
  return (
    <img
      className={`${className} ${ok ? 'ok' : ''}`}
      src={srcs[k]}
      alt=""
      decoding={eager ? 'sync' : 'async'}
      referrerPolicy="no-referrer"
      draggable={false}
      onLoad={(e) => {
        // a 1×1 placeholder or an empty body counts as a failure
        if (e.currentTarget.naturalWidth < 40) {
          if (k + 1 < srcs.length) setK(k + 1);
          else onDead();
          return;
        }
        setOk(true);
      }}
      onError={() => {
        if (k + 1 < srcs.length) setK(k + 1);
        else onDead();
      }}
    />
  );
}

/** Swipeable ad gallery: photo count, dots, tap to open full screen. Falls back to a studio silhouette. */
export function Gallery({
  photos,
  body,
  color,
  covered,
  children,
}: {
  photos?: string[];
  body: Body;
  color?: string;
  covered?: boolean;
  children?: React.ReactNode;
}) {
  const [bad, setBad] = useState<Set<string>>(new Set());
  const list = useMemo(() => (photos ?? []).filter((u) => !bad.has(u)), [photos, bad]);
  const [i, setI] = useState(0);
  // photos are fetched just ahead of the swipe: the current one and its neighbours, never all eight at once
  const [want, setWant] = useState(2);
  const [zoom, setZoom] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setI(0);
    setWant(2);
    track.current?.scrollTo({ left: 0 });
  }, [photos]);
  useEffect(() => {
    setWant((w) => Math.max(w, i + 3));
  }, [i]);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const k = Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth));
    if (k !== i) setI(k);
  };
  const go = (k: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(list.length - 1, k));
    el.scrollTo({ left: -n * el.clientWidth, behavior: 'smooth' });
  };
  const drop = (u: string) => setBad((s) => new Set(s).add(u));
  const backdrop = list[Math.min(i, list.length - 1)];

  return (
    <div className={`gallery ${covered ? 'covered' : ''} ${list.length ? '' : 'empty'}`}>
      {list.length ? (
        <>
          {/* phone photos are mostly portrait: one soft fill of the current photo sits behind the frame */}
          {backdrop && <Photo key={`fill-${backdrop}`} u={backdrop} className="g-fill" onDead={() => {}} />}
          <div className="g-track" ref={track} onScroll={onScroll}>
            {list.map((u, k) => (
              <div className="g-slide" key={u} onClick={() => !covered && setZoom(k)}>
                {k < want && <Photo u={u} eager={k === 0} className="g-img" onDead={() => drop(u)} />}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="g-studio">
          <Silhouette body={body} color={covered ? '#1d2a23' : color} mono={covered} />
        </div>
      )}
      {covered && (
        <div className="g-cover" aria-hidden="true">
          <span>؟</span>
        </div>
      )}
      <div className="g-badges">{children}</div>
      {list.length > 1 && !covered && (
        <>
          <div className="g-count ltr">
            {i + 1}/{list.length}
          </div>
          <div className="g-dots" aria-hidden="true">
            {list.slice(0, 9).map((u, k) => (
              <i key={u} className={k === i ? 'on' : ''} />
            ))}
          </div>
          <button className="g-nav prev" aria-label="الصورة السابقة" onClick={() => go(i - 1)} disabled={i === 0}>
            ›
          </button>
          <button className="g-nav next" aria-label="الصورة التالية" onClick={() => go(i + 1)} disabled={i >= list.length - 1}>
            ‹
          </button>
        </>
      )}
      {zoom != null && <Lightbox photos={list} start={zoom} onClose={() => setZoom(null)} onDead={drop} />}
    </div>
  );
}

function Lightbox({ photos, start, onClose, onDead }: { photos: string[]; start: number; onClose: () => void; onDead: (u: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(start);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ left: -start * el.clientWidth });
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [start, onClose]);
  return (
    <div className="lightbox" role="dialog" aria-label="صور الإعلان">
      <div
        className="lb-track"
        ref={ref}
        onScroll={() => {
          const el = ref.current;
          if (el) setI(Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth)));
        }}
      >
        {photos.map((u, k) => (
          <div className="lb-slide" key={u}>
            {/* full-size originals are heavy: only the one on screen and its neighbours */}
            {Math.abs(k - i) <= 1 && <Photo u={u} full eager={k === i} className="lb-img" onDead={() => onDead(u)} />}
          </div>
        ))}
      </div>
      <div className="lb-bar">
        <span className="ltr">
          {i + 1}/{photos.length}
        </span>
        <button className="btn btn-ghost" onClick={onClose}>
          سكّر
        </button>
      </div>
    </div>
  );
}
