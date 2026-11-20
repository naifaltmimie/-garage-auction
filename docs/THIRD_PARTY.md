# Third-party material

## The number plate's lettering (src/ui/components/plateGlyphs.ts)

The plate draws its characters as SVG paths taken from three fonts by `scripts/brand/plate/gen_glyphs.py`.
The font files and their full licence texts are kept next to the generator in `scripts/brand/plate/fonts/`.
The game ships only the outlines, as path data; it does not ship or rename the fonts themselves.

| Used for | Font | Copyright | Licence |
|---|---|---|---|
| Latin digits and letters | D-DIN PRO Medium | Copyright (C) 2026 CyberFei, https://github.com/CyberFei/D-DIN-PRO (Reserved Font Name "D-DIN-PRO") | SIL Open Font License 1.1 (`fonts/D-DIN-PRO-OFL.txt`) |
| Arabic-Indic digits, Arabic letters, «السعودية» | Noto Naskh Arabic Bold | Copyright 2022 The Noto Project Authors, https://github.com/notofonts/arabic | SIL Open Font License 1.1 (`fonts/NotoNaskhArabic-LICENSE.txt`) |
| K, S, A on the strip | Arimo Bold | Copyright 2020 The Arimo Project Authors, https://github.com/googlefonts/arimo | SIL Open Font License 1.1 (`fonts/Arimo-LICENSE.txt`) |

The national emblem on the plate is drawn in code (`scripts/brand/plate/emblem.py`) as a simple silhouette; no
artwork file is copied.
