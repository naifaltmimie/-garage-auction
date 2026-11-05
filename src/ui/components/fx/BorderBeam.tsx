/**
 * A thin light that travels around its parent's border — marks the one card that is live right now.
 * The parent needs `position: relative` and a border-radius; the beam inherits the radius.
 * Only a transform rotates (inside a static mask), so it stays on the compositor.
 */
export function BorderBeam({ tone = 'gold' }: { tone?: 'gold' | 'light' }) {
  return (
    <span className={`fx-beam ${tone}`} aria-hidden="true">
      <span />
    </span>
  );
}
