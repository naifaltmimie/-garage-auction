# مزاد الكراج: the design law

Read this before touching any screen. It is short on purpose.

## Three colours and one metal

| Role | Tokens (`src/styles/theme.css`) | Where |
|---|---|---|
| Rubber black | `--rubber-0…5`, `--bg`, `--card`, `--line`, `--line-2` | every surface |
| Chalk white | `--ink`, `--ink-2`, `--mute`, `--dim` | text, prices, numbers, icons |
| Caliper red | `--brand`, `--brand-hi`, `--brand-lo`, `--brand-50`, `--brand-100` | only: a screen's one primary action, the last seconds of a clock, the hammer (the «بيعت» stamp), the logo's tag, the leader's red plate |
| Alloy, the rim's metal | `--alloy-hi`, `--alloy`, `--alloy-mid`, `--alloy-lo`, `--alloy-face`, `--alloy-ink`, `--alloy-50`, `--alloy-100` | prestige only: the winner, trophies, special plates, «صارت لك», the player's own row |
| Paper | `--plate`, `--plate-ink` | real paper things: number plates, paddles, lot stickers, the QR, receipts |
| Green | `--ok`, `--ok-700` | money gained and a passed check, as small text or a small mark |

- No gold, yellow, amber, bronze, beige or brown anywhere. The `--gold*` and `--amber*` names still exist only as aliases of the alloy and the chalk.
- Red is never decoration and never appears twice competing in one view. The player's own things are alloy or a chalk «أنت», not red.
- The logo (`public/brand/*.svg`) is never recoloured, stretched, cropped or put inside a shape.

## The tyre is real

The wheel is a 3D render (`scripts/brand/wheel` → `public/brand/wheel`), shown with `<Wheel/>` and `<TireLoader/>`: the tyre and rim turn, the brake disc, the red caliper and the light stay put. No drawn tyres, no zigzag tread, no studs. It appears in few deliberate places: the wait, the home hero, the big screen.

## No slop

1. No card inside a card. One surface level per region; group with space and a 1px hairline.
2. No decorative glow, gradient border, shimmer loop, sparkle, halo or glass. A shadow lifts only what is pressable or a sheet over content.
3. A pill or badge only for a live status the player needs now. No kicker above every title.
4. Type carries the hierarchy: three sizes per screen, weights 800 / 600 / 500. Where money matters the price is the biggest thing, in tabular Latin digits.
5. Radii: 14px surfaces, 12px buttons, 8px small parts. 4px spacing grid, 16px side gutters.
6. Motion: transform and opacity only, 300ms or less; a spring only on the hammer and the stamp; nothing loops forever except the wheel while waiting and the live clock.
7. Copy: Saudi dialect, short, no exclamation marks, no emoji.

## The auction is real

Use the real thing's cues, sparingly: the lot number as a windshield sticker, paddles as white paper with black digits, a red rubber «بيعت» stamp, the دلال's line, «كشف التسوية» as a receipt, and every car with its own file: its story, what the viewing showed, and the inspector's measured readings.
