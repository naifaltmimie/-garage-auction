import { useEffect, useRef, useState } from 'react';
import { money } from '../../../lib/util';
import { easeOut, prefersReducedMotion } from './motion';

// last value shown per ticker id, so a ticker that gets remounted (keyed parents) still rolls from where it was
const memory = new Map<string, number>();

/**
 * A money amount that rolls up to its new value, like the board in a sale room.
 * Only rises roll (a new lot or a lower number just snaps), and it never takes longer than `ms`.
 */
export function NumberTicker({ value, id, ms = 380, format = money }: { value: number; id?: string; ms?: number; format?: (n: number) => string }) {
  const start = id != null && memory.has(id) ? memory.get(id)! : value;
  const [shown, setShown] = useState(start);
  const cur = useRef(start);

  useEffect(() => {
    const from = cur.current;
    if (id != null) memory.set(id, value);
    if (memory.size > 64) memory.delete(memory.keys().next().value as string);
    if (from === value || value < from || prefersReducedMotion()) {
      cur.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const v = k >= 1 ? value : Math.round(from + (value - from) * easeOut(k));
      cur.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, id, ms]);

  return <span className={`fx-tick ${shown !== value ? 'rolling' : ''}`}>{format(shown)}</span>;
}
