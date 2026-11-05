// The car market (every model plus every real Haraj ad) is over a megabyte of data that only the
// host's phone needs, to deal the night. It ships as its own lazy chunk so a player joining a room
// never downloads it. Home's showroom and the Lobby/Create car counts use the small precomputed
// tables in showroom.ts and depth.ts instead (scripts/build_showroom.ts).
import type { CarModel } from '../engine/types';
import type { AdSet } from './photos';

/** Live bindings: empty until loadMarket() resolves, then the full catalogue and its ads. */
export let CATALOGUE: CarModel[] = [];
export let PHOTOS: Record<string, AdSet[]> = {};

let loading: Promise<void> | null = null;
let ready = false;

export function marketReady(): boolean {
  return ready;
}

/** Fetch the market chunk once; every later call returns the same promise. */
export function loadMarket(): Promise<void> {
  if (!loading) {
    const p = Promise.all([import('./catalogue'), import('./photos')]).then(([c, ph]) => {
      CATALOGUE = c.CATALOGUE;
      PHOTOS = ph.PHOTOS;
      ready = true;
    });
    // a dropped connection must be able to try again
    p.catch(() => {
      if (loading === p) loading = null;
    });
    loading = p;
  }
  return loading;
}
