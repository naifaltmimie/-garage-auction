// Text facts on one wrapping line, separated by a middle dot. A good fact carries a small green check,
// a warning a small red dot. This replaces outlined pills. Each fact carries its dot before it; the dot of a
// fact that starts a line falls outside the clipped edge, so no line starts or ends with a stray dot.
import { Icon } from '../Bits';

export type Fact = string | { t: string; tone?: 'good' | 'warn' };

export function Facts({ items, className }: { items: Fact[]; className?: string }) {
  const list = items.map((f) => (typeof f === 'string' ? { t: f, tone: undefined } : f));
  return (
    <div className={className ? `facts ${className}` : 'facts'}>
      <ul className="facts-in">
        {list.map((f, i) => (
          <li key={`${f.t}-${i}`} className={f.tone ? `fact ${f.tone}` : 'fact'}>
            {f.tone === 'good' && <Icon name="check" size={13} className="fact-mark" />}
            {f.tone === 'warn' && <i className="fact-dot" aria-hidden="true" />}
            {f.t}
          </li>
        ))}
      </ul>
    </div>
  );
}
