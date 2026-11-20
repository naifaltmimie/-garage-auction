// Pairs: ruled facts in two columns, the label small above its value, a hairline under each pair, no boxes.
// For a handful of short facts a player reads at a glance (the car's mileage, spec, grade…). A good fact may carry
// a small green check, a bad one a small red dot; the word itself always says it too.
import type { ReactNode } from 'react';
import { Icon } from '../Bits';

export type Pair = { k: string; v: ReactNode; tone?: 'good' | 'bad' };

/** The small status mark used beside a value: a green check for good, a red dot for bad, nothing otherwise. */
export function Mark({ tone }: { tone?: 'good' | 'bad' | 'mid' | 'unknown' }) {
  if (tone === 'good') return <Icon name="check" size={13} className="pr-mark good" />;
  if (tone === 'bad') return <i className="pr-mark bad" aria-hidden="true" />;
  return null;
}

export function Pairs({ items, className }: { items: Pair[]; className?: string }) {
  return (
    <dl className={className ? `pairs ${className}` : 'pairs'}>
      {items.map((p) => (
        <div className="pr" key={p.k}>
          <dt>{p.k}</dt>
          <dd>
            <Mark tone={p.tone} />
            <span className="pr-v">{p.v}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
