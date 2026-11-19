import { Wheel } from './Wheel';

/**
 * The wait: the real wheel turning on the spot over its own shadow, thin speed streaks sliding past on the ground.
 * Use it anywhere the player waits (connecting, the host loading the market, envelopes, votes).
 * `label` is the line under it; keep it short and say what we're waiting for.
 */
export function TireLoader({ label, size = 54, className }: { label?: string; size?: number; className?: string }) {
  return (
    <div className={['tire-loader', className].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <div className="tl-stage" style={{ ['--tl' as string]: `${size}px` }} aria-hidden="true">
        <i className="tl-streak" />
        <i className="tl-streak" />
        <i className="tl-streak" />
        <Wheel size={size} spin className="tl-wheel has-ground" />
      </div>
      {label && <p className="tl-label">{label}</p>}
    </div>
  );
}
