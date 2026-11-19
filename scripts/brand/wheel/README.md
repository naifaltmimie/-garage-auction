# The wheel renders

`scene.js` is the model (tyre, rim, brake, light rigs), `render.html` exposes `window.renderLayer(name, size)`,
`render.py` drives it in headless Chromium and writes WebP into `public/brand/wheel/`.

Re-run (three installed anywhere outside the repo with `npm i three`):

    THREE_DIR=<path>/node_modules/three/build SIZE=1024 python3 scripts/brand/wheel/render.py wheel brake full

Layers: wheel, brake, full, hero, tread, track. SIZE is the render size before LANCZOS downsampling (2048 default).
