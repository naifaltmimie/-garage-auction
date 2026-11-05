import { useMemo } from 'react';

function paths(n: number, seed: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const y = 18 + i * (264 / n);
    const a = 26 + ((i * 37 + seed) % 30);
    const s = (i % 2 ? 1 : -1) * a;
    out.push(`M -60 ${y.toFixed(1)} C 90 ${(y + s).toFixed(1)}, 210 ${(y - s * 0.9).toFixed(1)}, 460 ${(y + s * 0.35).toFixed(1)}`);
  }
  return out;
}

/**
 * Fine engraved lines behind a hero — like the guilloché on a cheque or a sale-catalogue cover.
 * Two layers drift slowly in opposite directions (transform only); hidden for reduced motion.
 */
export function BackgroundPaths({ className = '' }: { className?: string }) {
  const a = useMemo(() => paths(9, 3), []);
  const b = useMemo(() => paths(7, 17), []);
  return (
    <div className={`fx-paths ${className}`} aria-hidden="true">
      <svg className="fx-paths-a" viewBox="0 0 400 300" preserveAspectRatio="none">
        {a.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <svg className="fx-paths-b" viewBox="0 0 400 300" preserveAspectRatio="none">
        {b.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}
