/**
 * The wait, in this game's own words: a tyre rolling along a road, the lane marks sliding past.
 * Use it anywhere the player waits (connecting, the host loading the market, envelopes, votes).
 * `label` is the line under it; keep it short and say what we're waiting for.
 */
export function TireLoader({ label, size = 54, className }: { label?: string; size?: number; className?: string }) {
  return (
    <div className={['tire-loader', className].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <div className="tl-stage" style={{ ['--tl' as string]: `${size}px` }} aria-hidden="true">
        <i className="tl-tire" />
        <i className="tl-road" />
      </div>
      {label && <p className="tl-label">{label}</p>}
    </div>
  );
}
