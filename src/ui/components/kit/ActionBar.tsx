// The sticky bottom block that holds a screen's one action within thumb reach: 56px action, 16px gutters,
// the safe area under it, and an optional status line over it. It publishes its height as --actbar-h on the
// root, and the page keeps that much room under its last line, so nothing stays hidden under it.
import { useLayoutEffect, useRef, type ReactNode } from 'react';

export function ActionBar({ children, line, label = 'الإجراء', className }: { children: ReactNode; line?: ReactNode; label?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const put = () => root.style.setProperty('--actbar-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    put();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(put) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--actbar-h');
    };
  }, []);
  return (
    <div ref={ref} className={className ? `actbar ${className}` : 'actbar'} role="region" aria-label={label}>
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
