# The wheel renders

Every pixel here is lit in 3D (three.js in headless Chromium, WebGL2 through SwiftShader); nothing is painted on after.

- `scene.js` is the model and the light: the tyre (lathe with the tread height map displaced into it, moulded sidewall
  ribs and lettering), the five split-Y spokes (extruded, tessellated, bent into a concave sweep with a crowned face whose
  normals come from that height field, crisp creased bevels; machined face, gunmetal sides), the polished lip, the hub
  with five recessed nuts, the red enamel centre cap, the drilled disc, its hat, the red clear-coated caliper and the dark
  well behind; the axis-symmetric ring environment for the turning layers and the studio environments for the stills.
- `render.html` exposes `window.renderLayer(name, size, height)`.
- `render.py` drives it, takes the hero's ambient occlusion (GTAO) and multiplies it in linear light, crops, downsamples
  with LANCZOS and writes WebP into `public/brand/wheel/`; it also turns the tread height map into the chalk track.

Re-run (three installed anywhere outside the repo with `npm i three`; `build/` and `examples/jsm/` are served):

    THREE_DIR=<path>/node_modules/three/build SIZE=2048 python3 scripts/brand/wheel/render.py wheel brake full hero tread track

Preview at `SIZE=768 OUT_DIR=<scratch>` first; a 2048 hero takes several minutes. `P='{"heroExposure":1.5}'` sets the
knobs listed at the top of `render.html`.

Outputs: `wheel-512/160` (tyre and rim, see-through between the spokes, turns), `brake-512/160` (disc, caliper and the dark
well, never turns), `wheel-full-320` (the still), `hero-1200` and `hero-960` (the 3/4 beauty shot with its contact shadow
in the alpha), `tread-512` (the tread face flat, tiles left-right), `track-512` (the print, tiles left-right).
