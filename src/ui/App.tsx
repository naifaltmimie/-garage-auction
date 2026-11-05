import { useEffect, useRef, useState } from 'react';
import { isCode, normalizeCode } from '../lib/util';
import { Create } from './screens/Create';
import { Home } from './screens/Home';
import { HowTo } from './screens/HowTo';
import { RoomGate } from './screens/Room';
import { Tv, tvCodeOf } from './screens/Tv';

export type Route = { name: 'home' } | { name: 'new' } | { name: 'rules' } | { name: 'room'; code: string };

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (!h) return { name: 'home' };
  if (h === 'new') return { name: 'new' };
  if (h === 'rules') return { name: 'rules' };
  const m = /^(?:r\/)?([A-Za-z0-9]{6})$/.exec(h);
  if (m) {
    const code = normalizeCode(m[1]);
    if (isCode(code)) return { name: 'room', code };
  }
  return { name: 'home' };
}

export function go(path: string) {
  location.hash = path;
}

// ---------------------------------------------------------------- the phone's back gesture
// Inside a room, Android back / iOS swipe-back / the browser's back button must never drop a
// player out of a live auction. While anything in the room listens, one extra history entry
// (the guard) sits on top of the room's URL; a back press lands on the entry under it, which has
// the same URL, so nothing navigates. We put the guard back and hand the press to whoever is on
// top: an open sheet closes, and with nothing open the room asks before leaving.

const GUARD = 'mzk-guard';
const backStack: (() => void)[] = [];

function armGuard() {
  try {
    if ((history.state as { mzk?: string } | null)?.mzk !== GUARD) history.pushState({ mzk: GUARD }, '', location.href);
  } catch {
    /* history locked down (some in-app browsers): back just works the old way */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    if (!backStack.length) return;
    if ((e.state as { mzk?: string } | null)?.mzk === GUARD) return;
    if (parse(location.hash).name !== 'room') return;
    armGuard();
    backStack[backStack.length - 1]();
  });
}

/** While `open`, a back press calls `close` instead of leaving the page. The latest caller wins. */
export function useBack(open: boolean, close: () => void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!open) return;
    const fn = () => ref.current();
    backStack.push(fn);
    armGuard();
    return () => {
      const i = backStack.lastIndexOf(fn);
      if (i >= 0) backStack.splice(i, 1);
    };
  }, [open]);
}

/** Leave a room for Home without leaving a room entry for the back button to fall into. */
export function goHome() {
  if ((history.state as { mzk?: string } | null)?.mzk === GUARD) location.replace(`${location.pathname}${location.search}#/`);
  else go('/');
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const tv = tvCodeOf(location.hash);
  if (tv) return <Tv key={tv} code={tv} />;
  if (route.name === 'new') return <Create />;
  if (route.name === 'rules') return <HowTo />;
  if (route.name === 'room') return <RoomGate key={route.code} code={route.code} />;
  return <Home />;
}
