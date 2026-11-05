import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The car market (catalogue.ts + photos.ts, ~1.2 MB) is a lazy chunk that only the host's phone
// fetches, through src/data/market.ts. One static import anywhere would drag it back into every
// player's first load, so the build says so loudly.
const marketStaysLazy: Plugin = {
  name: 'market-stays-lazy',
  apply: 'build',
  generateBundle(_, bundle) {
    for (const c of Object.values(bundle)) {
      if (c.type !== 'chunk' || !c.isEntry) continue;
      const hit = Object.keys(c.modules).filter((id) => /src[\\/]data[\\/](catalogue|photos)\.ts$/.test(id));
      if (hit.length) {
        this.warn(`${hit.map((h) => h.split(/[\\/]/).pop()).join(' + ')} landed in the entry chunk ${c.fileName}: import the market through loadMarket() in src/data/market.ts (Home uses data/showroom.ts, counts use data/depth.ts)`);
      }
    }
  },
};

export default defineConfig({
  plugins: [react(), marketStaysLazy],
  build: { target: 'es2020', chunkSizeWarningLimit: 900, assetsInlineLimit: 0 },
  server: { host: true, port: 5173 },
});
