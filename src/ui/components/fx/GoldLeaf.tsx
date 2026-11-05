import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './motion';

type Leaf = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; f: number; vf: number; c: string };

const TONES = ['#f4e2a8', '#e2bf68', '#d6ad52', '#b98c31', '#fff4d2'];
// one burst per sale: reopening the result after «رجوع للتقرير» doesn't throw the leaf again
const fired = new Set<string>();

/**
 * Gold leaf, not party confetti: a few dozen thin flakes thrown up from the stamp at the hammer's impact,
 * flipping as they fall and fading out. Only the buyer's phone gets it. Removes itself (≈2.4s).
 */
export function GoldLeaf({ count = 42, delay = 330, from = '.rv-stamp', once }: { count?: number; delay?: number; from?: string; once?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || (once != null && fired.has(once))) {
      setDone(true);
      return;
    }
    let raf = 0;
    const timer = window.setTimeout(() => {
      if (once != null) fired.add(once);
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return setDone(true);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const box = document.querySelector(from)?.getBoundingClientRect();
      const ox = box ? box.left + box.width / 2 : w / 2;
      const oy = box ? box.top + box.height * 0.4 : h * 0.3;
      const leaves: Leaf[] = Array.from({ length: Math.min(60, count) }, (_, i) => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
        const v = 6 + Math.random() * 7;
        return {
          x: ox + (Math.random() - 0.5) * (box ? box.width * 0.8 : 80),
          y: oy + (Math.random() - 0.5) * 16,
          vx: Math.cos(a) * v * 0.9,
          vy: Math.sin(a) * v,
          w: 5 + Math.random() * 8,
          h: 2.5 + Math.random() * 4,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.24,
          f: Math.random() * Math.PI * 2,
          vf: 0.1 + Math.random() * 0.16,
          c: TONES[i % TONES.length],
        };
      });
      const t0 = performance.now();
      let last = t0;
      const LIFE = 2300;
      const tick = (t: number) => {
        const dt = Math.min(34, t - last) / 16.67;
        last = t;
        const age = t - t0;
        ctx.clearRect(0, 0, w, h);
        const fade = Math.max(0, 1 - Math.max(0, age - LIFE + 650) / 650);
        for (const p of leaves) {
          // thrown up, then air takes over: heavy drag + a flutter, like real leaf
          p.vy += 0.24 * dt;
          const drag = Math.pow(p.vy > 0 ? 0.93 : 0.975, dt);
          p.vx *= drag;
          p.vy *= drag;
          p.f += p.vf * dt;
          p.x += (p.vx + Math.sin(p.f) * 0.9) * dt;
          p.y += p.vy * dt;
          p.r += p.vr * dt;
          const flip = Math.cos(p.f);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.scale(1, Math.abs(flip) < 0.12 ? 0.12 : flip);
          ctx.globalAlpha = fade * (0.75 + 0.25 * Math.abs(flip));
          ctx.fillStyle = flip > 0 ? p.c : '#9c7526';
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        if (age < LIFE) raf = requestAnimationFrame(tick);
        else setDone(true);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [count, delay, from, once]);

  if (done) return null;
  return <canvas ref={ref} className="fx-leaf" aria-hidden="true" />;
}
