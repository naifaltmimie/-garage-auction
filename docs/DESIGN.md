# مزاد الكراج: the design law, version 2

Read this before touching any screen. The kit page `#/kit` shows every rule below, built.

## The world: حراج الليل
A car auction yard at night, made of three materials. **Rubber and asphalt** for every surface (matte, near-black).
**White paper** for everything a real auction prints: price tags, stickers, paddles, plates, receipts.
**Red enamel** for the tag, the stamp, the caliper and the one action. Alloy is the trophy metal.
The logo's language (heavy lettering, the tag with its punched hole, the diamond dot) is the brand's voice.

## Three type roles, no fourth family
| Role | Token | Face | Used for |
|---|---|---|---|
| Voice | `--f-voice` (= `--f-display`) | Lalezar 400 | screen titles, stamp words, the دلال's calls, award names, the label of a screen's primary action. Short phrases, 22px and up |
| Print | `--f-print` (= `--f-num`) | Barlow Condensed 700/800 | every number printed on an object or counted: prices, wallet, counters, clocks, stickers, receipts, plate Latin. Tabular, Latin digits, LTR isolated |
| Text | `--f-ui` | Readex Pro (variable, 400–700) | sentences, labels, hints, secondary buttons. A number inside a sentence stays Text |

- Scale (theme.css): voice `--t-voice-xl 44 / l 34 / m 26 / s 22`; print `--t-print-xxl 68 / xl 54 / l 32 / m 22 / s 16`;
  text `--t-body 17 / --t-sub 15 / --t-cap 13`. Utilities: `.voice-*`, `.print-*`, `.text-*`, plus `.voice` and `.print`.
- `font-synthesis: none`: Lalezar has one weight; never ask it for bold. Arabic text never gets letter-spacing.
- Lalezar reads about 18% smaller than Plex at the same px; Barlow's digits are narrower, so prices sit a step up.
- Buttons: `.btn-primary`, `.btn-gold` and the bid button speak Voice 22px; any number on them is Print. All other buttons are Text 700.

## Three colours and one metal (unchanged)
| Role | Tokens | Where |
|---|---|---|
| Rubber black | `--rubber-0…5`, `--bg`, `--card`, `--line`, `--line-2` | every surface |
| Chalk white | `--ink`, `--ink-2`, `--mute`, `--dim` | text, numbers, icons, focus rings |
| Caliper red | `--brand*` | only: a screen's one primary action, the last seconds of a clock, the stamp, the logo's tag, the leader's red plate |
| Alloy | `--alloy*` | prestige only: the winner, trophies, special plates, «صارت لك», the player's own row |
| Paper | `--plate`, `--plate-ink` | paper things, and the chosen thumb of a control |
| Green | `--ok`, `--ok-700` | money gained and a passed check, as small text or a small mark |

No gold, yellow, amber, brown, blue or purple. Red never decorates: links, counts, step numbers and kick actions are chalk.
The logo (`public/brand/*.svg`) is never recoloured, stretched, cropped or boxed.

## Objects (src/ui/components/kit/)
- **PriceTag** (the live price on the logo's tag), **Stamp** («بيعت» / «ما بيعت», red ink, slams once), **Sticker** (the lot
  number on the windscreen), **Receipt** (thermal paper with a torn edge), **RollingNumber**: props documented in `KitObjects.tsx`.
- **Paddle**, **Plate** and the **Wheel** (the 3D render, `<Wheel/>`, `<TireLoader/>`): no drawn tyres anywhere else.
- **ScreenTitle** (the one title, Voice `--t-voice-l`, optional caption), **Rows** (ruled label/value list, no boxes),
  **Facts** (text facts with a middle dot, instead of pills), **Field** + `Seg`, `Stepper`, `Switch` (labelled settings:
  sunk rubber track, chosen thumb in white paper with black text, 44px, numbers in Print).
- **Icon** (`Bits.tsx`): one family, Phosphor (MIT), `bold` for bars and buttons, `fill` for small status marks; the tyre is
  authored in the same weight. The car faces left, back points right, the exit leaves left.

## Craft floor (bans)
- No card inside a card; no page of same-size icon + heading + text cards; no numbered circles for steps.
- No kicker above a heading. No pill or outlined chip unless it is a live status the player needs now.
- No decorative glow, gradient text, glass blur, coloured side-border, shimmer loop or sparkle.
- No unicode glyph or emoji standing in for an icon. No unlabelled control.
- Browser surfaces are themed: selection (chalk on rubber-5), caret, thin dark scrollbars, a 2px chalk focus ring with 2px offset,
  no tap highlight.
- Contrast 4.5:1 for body, 3:1 for large text. Touch targets 44px. Nothing clips or overflows at 360px.
- Motion: one authored moment per screen; transform and opacity; `cubic-bezier(.16,1,.3,1)`; 300ms or less; a spring only on the
  stamp and the tag; honour `prefers-reduced-motion`.
- Copy: Saudi spoken dialect, short, no exclamation marks, no emoji, no English words in Arabic letters. Buttons name the action.
