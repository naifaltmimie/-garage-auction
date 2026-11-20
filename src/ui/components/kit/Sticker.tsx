// The car's number as the paper sticker an auction puts on a windscreen: «رقم» over two printed digits,
// optionally «من 10» under them, tilted, with one corner lifting off the glass.
export function Sticker({ no, of, className }: { no: number; of?: number; className?: string }) {
  const n = String(no).padStart(2, '0');
  return (
    <div className={`lotsticker${className ? ` ${className}` : ''}`} role="img" aria-label={of ? `رقم ${no} من ${of}` : `رقم ${no}`}>
      <span className="lotsticker-k" aria-hidden>رقم</span>
      <span className="lotsticker-n" aria-hidden>{n}</span>
      {of != null && <span className="lotsticker-of" aria-hidden>من {of}</span>}
    </div>
  );
}
