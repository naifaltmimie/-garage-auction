import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Body } from '../../engine/types';
import { Icon } from './Bits';
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

/** One photo that walks its fallback chain on error and fades in when it's ready (no black frames).
 *  Decoding is always async so a big Haraj jpeg never blocks a swipe. */
export function Photo({ u, full, className, onDead }: { u: string; full?: boolean; eager?: boolean; className: string; onDead: () => void }) {
  const srcs = useMemo(() => sourcesOf(u, full), [u, full]);
  const [k, setK] = useState(0);
  const [ok, setOk] = useState(false);
  return (
    <img
      className={`${className} ${ok ? 'ok' : ''}`}
      src={srcs[k]}
      alt=""
      decoding="async"
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

const noop = () => {};

/** The car's photos: full width, native scroll-snap, a small quiet counter, tap to open the viewer.
 *  Falls back to the studio silhouette when there are no photos (or every one is dead).
 *  The root keeps the class `gallery` as the hook the bidding block uses to cap the photo on short phones. */
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
  // synced state arrives as fresh arrays on every update: key the gallery on the photos themselves,
  // so a bid landing mid-swipe never throws the player back to photo one
  const sig = (photos ?? []).join('|');
  const [bad, setBad] = useState<Set<string>>(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => (photos ?? []).filter((u) => !bad.has(u)), [sig, bad]);
  const [i, setI] = useState(0);
  // only the photo on screen and the next one are fetched; the rest wait for the swipe
  const [want, setWant] = useState(2);
  const [zoom, setZoom] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setI(0);
    setWant(2);
    setZoom(null);
    track.current?.scrollTo({ left: 0 });
  }, [sig]);
  useEffect(() => {
    setWant((w) => Math.max(w, i + 2));
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
  const cur = Math.min(i, Math.max(0, list.length - 1));
  const backdrop = list[cur];

  return (
    <div className={`gallery sh-photo${covered ? ' is-covered' : ''}${list.length ? '' : ' is-empty'}`}>
      {list.length ? (
        <>
          {/* phone photos are mostly portrait: one soft fill of the current photo sits behind the frame */}
          {backdrop && !covered && <Photo key={`fill-${backdrop}`} u={backdrop} className="sh-fill" onDead={noop} />}
          <div className="sh-track" ref={track} onScroll={onScroll}>
            {list.map((u, k) =>
              covered ? (
                <div className="sh-slide" key={u}>
                  {k < want && <Photo u={u} className="sh-img" onDead={() => drop(u)} />}
                </div>
              ) : (
                <button
                  type="button"
                  className="sh-slide"
                  key={u}
                  aria-label={`افتح الصور، الصورة ${k + 1} من ${list.length}`}
                  onClick={() => setZoom(k)}
                >
                  {k < want && <Photo u={u} className="sh-img" onDead={() => drop(u)} />}
                </button>
              ),
            )}
          </div>
        </>
      ) : (
        <div className="sh-studio">
          <Silhouette body={body} color={covered ? '#2a2c31' : color} mono={covered} />
        </div>
      )}
      {covered && (
        <div className="sh-cover" aria-hidden="true">
          <span>تحت الغطا</span>
        </div>
      )}
      {children}
      {list.length > 1 && !covered && (
        <>
          <div className="sh-count print ltr" aria-hidden="true">
            {cur + 1}
            <span>/{list.length}</span>
          </div>
          <button type="button" className="sh-nav prev" aria-label="الصورة السابقة" onClick={() => go(cur - 1)} disabled={cur === 0}>
            <Icon name="back" size={18} />
          </button>
          <button type="button" className="sh-nav next" aria-label="الصورة التالية" onClick={() => go(cur + 1)} disabled={cur >= list.length - 1}>
            <Icon name="back" size={18} />
          </button>
        </>
      )}
      {zoom != null && list.length > 0 && <Lightbox photos={list} start={Math.min(zoom, list.length - 1)} onClose={() => setZoom(null)} onDead={drop} />}
    </div>
  );
}

/** Full-screen viewer, portalled to <body> so no ancestor transform or overflow can trap it.
 *  Swipe sideways for the next photo, swipe down, Escape or سكّر to close; pinch is the browser's own. */
function Lightbox({ photos, start, onClose, onDead }: { photos: string[]; start: number; onClose: () => void; onDead: (u: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [i, setI] = useState(start);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ left: -start * el.clientWidth });
    close.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const el = ref.current;
      if (!el) return;
      // the arrows move the way the photos read: right to left
      if (e.key === 'ArrowLeft') el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
      if (e.key === 'ArrowRight') el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
      // the close button is the only stop inside the viewer: Tab stays on it
      if (e.key === 'Tab') {
        e.preventDefault();
        close.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      root.style.overflow = prev;
      back?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return createPortal(
    <div className="sh-lb" role="dialog" aria-modal="true" aria-label="صور الإعلان">
      <div className="sh-lb-bar">
        <span className="sh-lb-count print ltr" role="status">
          {i + 1}
          <span>/{photos.length}</span>
        </span>
        <button ref={close} type="button" className="sh-lb-close" onClick={onClose}>
          <Icon name="close" size={18} />
          سكّر
        </button>
      </div>
      <div
        className="sh-lb-track"
        ref={ref}
        onScroll={() => {
          const el = ref.current;
          if (!el) return;
          const k = Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth));
          if (k !== i) setI(k);
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          const t = e.changedTouches[0];
          if (!s || !t) return;
          const dx = Math.abs(t.clientX - s.x);
          const dy = t.clientY - s.y;
          if (dy > 90 && dx < 50) onClose();
        }}
      >
        {photos.map((u, k) => (
          <div className="sh-lb-slide" key={u}>
            {/* the gallery's light copy shows at once; the heavy original fades in over it, only for the photo on screen and its neighbours */}
            {Math.abs(k - i) <= 1 && (
              <>
                <Photo u={u} className="sh-lb-img" onDead={() => onDead(u)} />
                {k === i && <Photo u={u} full className="sh-lb-img sh-lb-hi" onDead={noop} />}
              </>
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
