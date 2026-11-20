// The rubber stamp pressed on the car's photo: «بيعت» in red ink with a double border, the same stamp inked solid
// for the player who won it, or «ما بيعت» in chalk-grey. The outline is clean; the wear is inside the ink, from
// one static mask (public/brand/kit/ink-wear.webp). It slams once when it mounts; remount it to slam again.
export type StampKind = 'sold' | 'mine' | 'unsold';

export function Stamp({ kind, sub, className }: { kind: StampKind; sub?: string; className?: string }) {
  const word = kind === 'unsold' ? 'ما بيعت' : 'بيعت';
  return (
    <div className={`stamp2 stamp2-${kind}${className ? ` ${className}` : ''}`} role="img" aria-label={sub ? `${word}، ${sub}` : word}>
      <div className="stamp2-ink" aria-hidden>
        <div className="stamp2-face">
          <span className="stamp2-word">
            {word}
            {kind === 'mine' && <span className="stamp2-yours">لك</span>}
          </span>
          {sub && <span className="stamp2-sub">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
