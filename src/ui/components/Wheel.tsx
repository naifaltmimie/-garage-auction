// The real wheel: rendered in 3D (scripts/brand/wheel), not drawn. Three stacked layers:
// the brake disc and the red caliper stay put, the tyre and rim turn over them, and the light stays where it is.
// Styles and art live in src/styles/wheel.css and public/brand/wheel.

export function Wheel({
  size = 96,
  spin = false,
  className,
}: {
  /** rendered width and height in CSS px */
  size?: number;
  /** true turns it at cruising speed; 'slow' idles, 'fast' is a burnout */
  spin?: boolean | 'slow' | 'fast';
  className?: string;
}) {
  const cls = ['wheel', spin ? 'is-spin' : '', typeof spin === 'string' ? `is-${spin}` : '', size <= 160 ? 'is-small' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} style={{ ['--w' as string]: `${size}px` }} aria-hidden="true">
      <i className="wheel-brake" />
      <i className="wheel-rim" />
      <i className="wheel-light" />
    </span>
  );
}
