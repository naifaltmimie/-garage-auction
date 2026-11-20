// A printed number whose digits roll. Each digit sits in its own window, cut to the digits' ink (from just above
// the tallest digit to just below the baseline, not the whole line), and clipped to it; only the windows whose
// digit changes move, the old digit leaving by exactly one window height while the new one enters from the other
// side (up when the value rises, down when it falls), so no part of a rolling digit ever shows above or below
// the printed digits. Separators never move; one born with a new digit fades in with it. The width only changes
// when the number gains or loses a digit. Reduced motion swaps the digit with no travel (CSS).
// The cell keying (digits counted from the right, separators keyed to the digit after them) is ported from
// "Rolling Digits" by edwinvakayil on 21st.dev, rebuilt as plain React state and CSS keyframes, no library.
import { memo, useLayoutEffect, useRef, useState, type AnimationEvent } from 'react';
import { money } from '../../../lib/util';

type Dir = 'up' | 'down';

const isDigit = (c: string) => c >= '0' && c <= '9';

/** One window: the current character, and the leaving one stacked in the same grid cell while it rolls away. */
const Cell = memo(function Cell({ char, dir, born, sep }: { char: string; dir: Dir; born: boolean; sep?: boolean }) {
  const [roll, setRoll] = useState<{ from: string | null; n: number; dir: Dir }>({ from: null, n: born ? 1 : 0, dir });
  const last = useRef(char);

  useLayoutEffect(() => {
    if (last.current === char) return;
    const from = last.current;
    last.current = char;
    setRoll((r) => ({ from, n: r.n + 1, dir }));
  }, [char, dir]);

  const done = (e: AnimationEvent) => {
    if (e.target === e.currentTarget) setRoll((r) => (r.from === null ? r : { ...r, from: null }));
  };

  const moving = roll.n > 0 && (roll.from !== null || born);
  return (
    <span className={sep ? 'rn-cell rn-sep' : 'rn-cell'} aria-hidden={sep || undefined}>
      {roll.from !== null && (
        <span key={`o${roll.n}`} className={`rn-d rn-out rn-${roll.dir}`} aria-hidden>
          {roll.from}
        </span>
      )}
      <span key={`i${roll.n}`} className={`rn-d${moving ? (sep ? ' rn-fade' : ` rn-in rn-${roll.dir}`) : ''}`} onAnimationEnd={done}>
        {char}
      </span>
    </span>
  );
});

export function RollNumber({ value, className }: { value: number; className?: string }) {
  const text = money(value);
  const prev = useRef(value);
  const mounted = useRef(false);
  const dir: Dir = value < prev.current ? 'down' : 'up';

  useLayoutEffect(() => {
    prev.current = value;
    mounted.current = true;
  }, [value]);

  // key each character by its place counted from the right, so the ones stay the ones
  const chars = text.split('');
  let fromRight = 0;
  const keys = new Array<string>(chars.length);
  for (let i = chars.length - 1; i >= 0; i--) keys[i] = isDigit(chars[i]) ? `d${fromRight++}` : `s${fromRight}`;

  return (
    <span className={`rn${className ? ` ${className}` : ''}`} role="img" aria-label={text}>
      {chars.map((c, i) =>
        isDigit(c) ? (
          <Cell key={keys[i]} char={c} dir={dir} born={mounted.current} />
        ) : (
          <Cell key={keys[i]} char={c} dir={dir} born={mounted.current} sep />
        ),
      )}
    </span>
  );
}
