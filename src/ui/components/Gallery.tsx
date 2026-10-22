import { useEffect, useMemo, useRef, useState } from 'react';
import type { Body } from '../../engine/types';
import { Silhouette } from './Silhouette';

// Ad photos load straight from the listing CDN (no referrer). Hosts that refuse hotlinking go through
// our tiny image proxy instead.
const PROXY_HOSTS: string[] = [];
export function photoSrc(u: string): string {
  try {
    const h = new URL(u).host;
    if (PROXY_HOSTS.some((x) => h.endsWith(x))) return `/api/img?u=${encodeURIComponent(u)}`;
  } catch {
    /* relative */
  }
  return u;
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
  const [zoom, setZoom] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setI(0);
    track.current?.scrollTo({ left: 0 });
  }, [photos]);

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

  return (
    <div className={`gallery ${covered ? 'covered' : ''} ${list.length ? '' : 'empty'}`}>
      {list.length ? (
        <div className="g-track" ref={track} onScroll={onScroll}>
          {list.map((u, k) => (
            // phone photos are mostly portrait: show the whole frame over a blurred fill of itself
            <div className="g-slide" key={u} onClick={() => !covered && setZoom(k)}>
              <img className="g-fill" src={photoSrc(u)} alt="" aria-hidden="true" loading={k < 2 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" draggable={false} />
              <img
                className="g-img"
                src={photoSrc(u)}
                alt=""
                loading={k < 2 ? 'eager' : 'lazy'}
                decoding="async"
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setBad((s) => new Set(s).add(u))}
              />
            </div>
          ))}
        </div>
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
      {zoom != null && <Lightbox photos={list} start={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function Lightbox({ photos, start, onClose }: { photos: string[]; start: number; onClose: () => void }) {
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
        {photos.map((u) => (
          <div className="lb-slide" key={u}>
            <img src={photoSrc(u)} alt="" referrerPolicy="no-referrer" />
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
