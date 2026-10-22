# مزاد الكراج — v2

Multiplayer Arabic (RTL) car-auction party game for friends on their phones.

- **Stack:** Vite + React 18 + TypeScript. No accounts, no backend database.
- **Realtime:** the host's browser runs the auction engine (`src/engine/host.ts`); players send intents only.
  Messages go over public MQTT brokers (EMQX / HiveMQ / Mosquitto) via WSS, encrypted per room
  (`src/net/`). `api/relay.ts` is a Vercel WebSocket fallback for networks that block the brokers.
  Every core snapshot carries the lot/history revisions, so a phone that missed one asks the host again.
  The host's phone keeps its screen awake; if it still leaves the page, the clock holds for everyone.
- **Cars = real ads.** Every lot is one real Haraj ad with its own photos and words. The pipeline:
  1. `scripts/merge_v3.py` reads the researched catalogue (`research/cars_*.json`), the Haraj pack
     (`cars.json`, import/order offers, lease transfers and unsettled years left out) and the research
     agents' ads (`research/haraj_ads.json`, `research/new_ads/*.json`). One car posted twice is kept once.
     What an ad says wins over the catalogue: km, colour, cab (only «غمارة/غمارتين» in the text), drive
     («دبل» = 4x4, «دفع خلفي»), gearbox (next to «قير», so «مكيف يدوي» is not a manual), fuel, cylinders,
     engine size and stated horsepower, trim (Hellcat, ES 300H, GR Sport…). A stated engine is matched to
     the family's real alternative (a 6-cylinder Fortuner is the 4.0 V6, a 3.5 K8 is the V6) and never
     paired with the model's usual cylinder count. Model-years the research didn't cover are cloned from
     the same generation with hand-checked specs/values in `scripts/haraj_specs.py`. An asking price is not
     a sale: it pulls the car's value most of the way; one hopeful seller alone doesn't set a model-year.
     Seller lines keep the seller's own points — Haraj form fields, bare labels, headings, showroom
     boilerplate and cut-off words are left out.
  2. `scripts/build_catalogue.py` → `src/data/catalogue.ts` (only model-years a real ad covers).
  3. `scripts/build_photos.py` → `src/data/photos.ts`: photo QA (CLIP, run once) puts an exterior shot first
     and drops screenshots/papers; the sheet marks every detail the ad didn't state as the model's usual spec.
- **Markets:** متنوع، فخامة، سوبر كار، جموس ولاندات، سبورت، عائلي، حراج شعبي، ونيتات، كلاسيك الطيبين،
  ياباني، أمريكي، ألماني، صيني (`src/engine/markets.ts`).
- **No repeats:** phones remember every ad they were shown (`src/lib/seen.ts`) and send the list to the host;
  the deck never brings back an ad anyone in the room has seen while the market still has fresh ones.
- **Plates:** only truly special plates carry a tag and a price (حرف ورقم، حرفين ورقمين، رقم واحد، رقمين،
  7777…), priced from real Absher/Haraj sales.
- **Names:** codes Saudis write in English stay English (BMW M4, لكزس LX570, مازدا CX-5); word names stay Arabic.
- **Look:** IBM Plex Sans Arabic everywhere (bundled from `@fontsource`), light official palette
  (stone, Saudi green, gold), long-format Saudi plates with the KSA strip.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # voice clips are fetched at build time
```

The previous version of the game lives on `main`.
