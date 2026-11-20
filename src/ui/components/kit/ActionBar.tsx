// The sticky bottom block that holds a screen's one action within thumb reach: 56px action, 16px gutters,
// the safe area under it, and an optional status line over it. It publishes its height as --actbar-h on the
// root, and the page keeps that much room under its last line, so nothing stays hidden under it.
import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** `inline` draws it in the flow (the kit page) instead of fixed to the bottom. */
export function ActionBar({ children, line, label = 'الإجراء', className, inline }: { children: ReactNode; line?: ReactNode; label?: string; className?: string; inline?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || inline) return;
    const root = document.documentElement;
    const put = () => root.style.setProperty('--actbar-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    put();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(put) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--actbar-h');
    };
  }, [inline]);
  return (
    <div ref={ref} className={['actbar', inline ? 'is-inline' : '', className].filter(Boolean).join(' ')} role="region" aria-label={label}>
      <div className="actbar-in">
        {line != null && (
          <p className="actbar-line" role="status">
            {line}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
