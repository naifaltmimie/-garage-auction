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
- **Ink room.** Readex's Arabic ink runs 0.49em under the baseline but the font declares 0.25em, so a Readex line inside a
  box that clips on the block axis loses the dots of a final ي unless its line-height is 1.73 or more. Either do not clip, or
  give the box `padding-bottom: .3em; margin-bottom: -.3em`. `scripts/qa/ink_audit.js` finds every clipped glyph.
- **Ellipsis.** Lalezar draws U+2026 as one dot; `base.css` supplies that one character from Readex. Type «…» (or let CSS
  truncate), never three full stops.
- **Direction.** A car's model and its trim sit in ONE `<bdi>` («812 Superfast», «G63 AMG»); in a plain string use `iso()`
  from `lib/util`; a spec line isolates each part. A year after a name is set apart with a middle dot.

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
A sentence is never red either: «زاودوا عليك» is chalk, and the amount to pay sits on the red button.
The logo (`public/brand/*.svg`) is never recoloured, stretched, cropped or boxed.

- **Alloy is brushed metal, not a gradient.** `--alloy-face` is a grain tile (`public/brand/kit/alloy-brush.webp`, drawn by
  `scripts/brand/alloy/brush.py`) over `--alloy-tone`; a large alloy surface also takes `--alloy-edge`. Text on alloy is
  `--alloy-ink`, captions `--alloy-deck`. The big screen redefines the grain's size in `tv.css`.
- **Gain and loss** are one component, `Delta` (`Garage.tsx`): a gain is green with its plus sign, a loss is chalk with a
  small red dot before it. No arrows or triangles.
- **«أنت»** beside the player's own name is a plain caption in `--mute`, not a chip.

## Objects (src/ui/components/kit/)
- **PriceTag** (the live price on the logo's tag), **Stamp** («بيعت» / «ما بيعت», red ink, slams once), **Sticker** (the lot
  number on the windscreen), **Receipt** (thermal paper with a torn edge), **RollingNumber**: props documented in `KitObjects.tsx`.
- **Paddle**, **Plate** and the **Wheel** (the 3D render, `<Wheel/>`, `<TireLoader/>`): no drawn tyres anywhere else.
- **ScreenTitle** (the one title, Voice `--t-voice-l`, optional caption), **Rows** (ruled label/value list, no boxes),
  **Facts** (text facts with a middle dot, instead of pills), **Field** + `Seg`, `Stepper`, `Switch` (labelled settings:
  sunk rubber track, chosen thumb in white paper with black text, 44px, numbers in Print).
- **Icon** (`Bits.tsx`): one family, Phosphor (MIT), `bold` for bars and buttons, `fill` for small status marks; the tyre is
  authored in the same weight. The car faces left, back points right, the exit leaves left.
- **Waiting** is the turning tyre (`TireLoader`), placed where the thing will land. No dashed blanks, skeleton bars or spinners.
- **A state with nothing to press** in the bid panel (your bid leads, wallet short, garage full, line cut) is one `Calm` line:
  an icon, a title in Voice, one sentence of what happens next. Never a greyed slab that looks like a dead button.
- **The paint map** (`DamageMap.tsx`) marks only what is not original: that panel is white paper with its code letter in black,
  the same letter the legend and the list use. Original panels are an outline, an uninspected one is dashed with «؟». The
  legend lists only this car's codes, then «الباقي أصلي». Every panel's tap area is 44px from a 360px phone.
- **Prestige** is an alloy band with engraved rules: the award's name in Voice, the winner's paper paddle beside his name,
  the figure in Print. The champion's band carries the `<Wheel/>` as the trophy. A number counts up in one place only.
  An earned badge is a paper sticker with its date; one not yet earned is a dashed outline with how to earn it.

## The big screen (`#/tv/CODE`, `Tv.tsx`, `tv.css`)
One sheet, every size in `--u` (a hundredth of a 16:9 screen's height), smallest text 2.6u, a 4u safe margin. It is a display:
no buttons, no hover. The band always says where to join («ادخل من جوالك:» the site's address, then the room's code). It shows
the phone's own objects at its scale (PriceTag, Stamp, Sticker, plate, Pairs, the Dutch `Board` and rail), and it reveals a
sale on the same stage clock as the phones (`ui/saleStage.ts`), so nobody reads a number early on either screen.

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
  The people are «المزايدين» and «كل واحد», never «لاعب»; a car is «سيارة», never «لوت». A thing is said once per screen.
  The buyer's own phone speaks to him («انقصّ عليك», and the roast through `roastSaid`); every other screen speaks about him.
- The one place emoji live is the reactions: the owner's own six, in his order (`src/engine/reactions.ts`). Never swap, add or reorder them.

## Proof
`python3 scripts/qa/atlas.py OUT BASE_URL PHOTOS_DIR MODE` plays a whole night and shoots every state: `main` (390 and the big
screen), `small` (360 and 320), `stress` (long names, seven-digit prices), `measure` (44px targets, contrast). Each shot is
checked for clipped ink, overflow and page errors; the report is `OUT/<size>/_report.md`. A change to a screen is not done
until its states are looked at in those shots and the report is clean.
