import { useEffect, useState } from 'react';
import { isCode, normalizeCode } from '../lib/util';
import { Create } from './screens/Create';
import { Home } from './screens/Home';
import { HowTo } from './screens/HowTo';
import { RoomGate } from './screens/Room';

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
  if (route.name === 'new') return <Create />;
  if (route.name === 'rules') return <HowTo />;
  if (route.name === 'room') return <RoomGate key={route.code} code={route.code} />;
  return <Home />;
}
