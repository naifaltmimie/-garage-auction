// A screen's one title, in the voice, with an optional one-line caption under it in the text face. No kicker.
import type { ReactNode } from 'react';

export function ScreenTitle({ children, caption, as: Tag = 'h1' }: { children: ReactNode; caption?: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <header className="screen-title">
      <Tag className="screen-title-h">{children}</Tag>
      {caption != null && <p className="screen-title-cap">{caption}</p>}
    </header>
  );
}
