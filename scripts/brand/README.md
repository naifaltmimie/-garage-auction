# The price-tag logo

`craft.py` draws the logo from real font outlines (Lalezar, shaped with HarfBuzz) and then cuts it by
hand in geometry: every alef and lam cut on the same slant, dots turned to diamonds, «مزاد» set on a
red auction tag, and one dark contour with a solid drop holding it together.

Needs `pip install uharfbuzz fonttools shapely` and the Lalezar `.woff` from `@fontsource/lalezar`
(set `FX` in `geo.py` to where it lives). Outputs go to `public/brand/` and `public/favicon.svg`:

    from craft import craft, tag_only
    craft(slug='lalezar', w=400, box_scale=0.56, ink='#0c0c0e')               # lockup.svg
    craft(slug='lalezar', w=400, layout='row', ink='#0c0c0e')                 # lockup-row.svg
    tag_only(slug='lalezar', w=400, text='مزاد', ink='#0c0c0e')               # tag.svg
    tag_only(slug='lalezar', w=400, text='م', square=True, pad=(0.3, 0.22))   # favicon.svg

Bump `V` in `src/ui/components/Logo.tsx` (and the `?v=` in index.html) when the drawings change.
