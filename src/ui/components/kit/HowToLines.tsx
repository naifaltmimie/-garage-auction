// «كيف نلعب» in three ruled lines, for the join and lobby screens: what a player does, what happens when the hammer
// falls, and how the night ends. The step number is a small printed figure, not a circle. Styles: s-home.css.
const LINES = ['سُم بزر واحد', 'اللي يرسي عليه ياخذها', 'آخر الليل تقيّمون الكراجات'] as const;

export function HowToLines({ className }: { className?: string }) {
  return (
    <ol className={className ? `htl ${className}` : 'htl'} aria-label="كيف نلعب">
      {LINES.map((t, i) => (
        <li key={t}>
          <span className="htl-n ltr" aria-hidden="true">
            {i + 1}
          </span>
          <span className="htl-t">{t}</span>
        </li>
      ))}
    </ol>
  );
}
