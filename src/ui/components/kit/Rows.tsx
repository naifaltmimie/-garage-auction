// A ruled list: the label on the right in muted text, the value on the left, a hairline between rows, no boxes.
// `print` sets the value as a printed number (Barlow Condensed, tabular).
import type { ReactNode } from 'react';

export type Row = { k: string; v: ReactNode; print?: boolean };

export function Rows({ items, className }: { items: Row[]; className?: string }) {
  return (
    <dl className={className ? `rows ${className}` : 'rows'}>
      {items.map((r, i) => (
        <div className="rows-r" key={`${r.k}-${i}`}>
          <dt>{r.k}</dt>
          <dd className={r.print ? 'rows-print' : undefined}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
