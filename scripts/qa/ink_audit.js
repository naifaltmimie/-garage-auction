// Clipped-ink audit. Returns the text lines whose painted glyphs (ink) are cut by a clipping ancestor while the
// line itself is on screen: Arabic dots under a final ي, tails of ج ع, a top hamza or shadda, Latin descenders.
// Runs in the page: () => auditInk(). Each finding: { text, cut: 'bottom'|'top', px, el, clip, font }.
//
// What counts as a clip, nearest first, html and body excepted:
//   - overflow-y hidden or clip (clip honours overflow-clip-margin), and contain: paint / content / strict;
//   - a scroll container (overflow-y auto or scroll, which is also what overflow-x: hidden alone gives) only when it
//     cannot scroll any further toward the cut side: ink is not scrollable overflow, so a line at the very end of a
//     scroller loses its descenders for good, while a line half scrolled out of view is just scrolled.
// Each line of a wrapped text node is measured on its own characters, so a descender on one line does not flag the
// lines above it. Elements hidden by an ancestor's opacity or visibility are skipped, and so is a line under a finite
// animation still running between it and its clip (a digit rolling through its cell is clipped on purpose).
// Lines under a scaled ancestor or CSS zoom are measured at their painted size: the font's ink metrics are scaled by
// the ratio of the line box on screen to the font's own ascent + descent (this covers zoom, which the computed font
// size leaves out, and transforms, which currentCSSZoom leaves out).
window.auditInk = function auditInk(opts) {
  const tol = (opts && opts.tol) || 0.75;
  const cv = document.createElement('canvas').getContext('2d');
  const root = document.documentElement;
  const path = (e) => {
    const out = [];
    for (let n = e, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
      const c = typeof n.className === 'string' ? n.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
      out.unshift(n.tagName.toLowerCase() + (c ? '.' + c : ''));
    }
    return out.join(' > ');
  };
  const clipCache = new Map();
  const clipsOf = (e) => {
    const clips = [];
    for (let n = e; n && n.nodeType === 1 && n !== root && n !== document.body; n = n.parentElement) {
      let c = clipCache.get(n);
      if (c === undefined) {
        c = null;
        const s = getComputedStyle(n);
        const oy = s.overflowY;
        const contain = s.contain || '';
        const paint = /paint|strict|content/.test(contain);
        const scroll = oy === 'auto' || oy === 'scroll';
        if (oy === 'hidden' || oy === 'clip' || paint || scroll) {
          const r = n.getBoundingClientRect();
          const bt = parseFloat(s.borderTopWidth) || 0;
          const bb = parseFloat(s.borderBottomWidth) || 0;
          const m = oy === 'clip' ? parseFloat(s.overflowClipMargin) || 0 : 0;
          c = {
            n,
            top: r.top + bt - m,
            bottom: r.bottom - bb + m,
            scroll,
            atTop: n.scrollTop <= 0.5,
            atEnd: n.scrollTop + n.clientHeight >= n.scrollHeight - 0.5,
          };
        }
        clipCache.set(n, c);
      }
      if (c) clips.push(c);
    }
    return clips;
  };
  const visible = (el) => {
    if (typeof el.checkVisibility === 'function') return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) !== 0;
  };
  // the line boxes of a text node, each with the characters painted on it
  const linesOf = (t, raw, rects) => {
    if (rects.length === 1 || raw.length > 1500) return rects.map((r) => ({ r, s: raw }));
    const out = rects.map((r) => ({ r, s: '' }));
    const rg = document.createRange();
    for (let i = 0; i < raw.length; i++) {
      rg.setStart(t, i);
      rg.setEnd(t, i + 1);
      const b = rg.getClientRects()[0];
      if (!b) continue;
      const mid = (b.top + b.bottom) / 2;
      let k = out.findIndex((o) => mid >= o.r.top - 0.5 && mid <= o.r.bottom + 0.5);
      if (k < 0) k = 0;
      out[k].s += raw[i];
    }
    return out.filter((o) => o.s.trim());
  };
  // a finite animation in flight (a rolling digit, a sheet sliding in) clips on purpose for a moment
  const moving = new Set();
  for (const a of document.getAnimations()) {
    const tm = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
    if (a.playState === 'running' && tm && tm.iterations !== Infinity && a.effect.target) moving.add(a.effect.target);
  }
  const inFlight = (el, stop) => {
    for (let n = el; n && n !== stop; n = n.parentElement) if (moving.has(n)) return true;
    return !!stop && moving.has(stop);
  };
  const seen = new Set();
  const found = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vw = innerWidth, vh = innerHeight;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const raw = t.nodeValue || '';
    if (!raw.trim()) continue;
    const el = t.parentElement;
    if (!el) continue;
    // a RollNumber digit mid-roll is clipped by its window on purpose
    if (el.closest('.rn-in, .rn-out')) continue;
    const clips = clipsOf(el);
    if (!clips.length) continue;
    if (!visible(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (!rects.length) continue;
    if (rects.every((r) => r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw)) continue;
    const s = getComputedStyle(el);
    cv.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    for (const { r, s: line } of linesOf(t, raw, rects)) {
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue; // off screen
      const m = cv.measureText(line.trim());
      // a scaled ancestor (the price tag on a small screen) scales the line box: the ink scales with it
      const k = r.height / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) || 1;
      const fd = m.fontBoundingBoxDescent * k, id = m.actualBoundingBoxDescent * k, ia = m.actualBoundingBoxAscent * k;
      const base = r.bottom - fd;
      const inkBottom = base + id, inkTop = base - ia;
      for (const c of clips) {
        if (base <= c.top || base - ia * 0.5 >= c.bottom) continue; // the line itself is hidden: intended (or scrolled)
        const cutB = inkBottom - c.bottom, cutT = c.top - inkTop;
        let cut = cutB > tol ? ['bottom', cutB] : cutT > tol ? ['top', cutT] : null;
        if (cut && c.scroll && !(cut[0] === 'bottom' ? c.atEnd : c.atTop)) cut = null; // the reader can scroll to it
        if (!cut) continue;
        if (moving.size && inFlight(el, c.n)) break;
        const key = path(el) + '|' + path(c.n) + '|' + cut[0];
        if (seen.has(key)) break;
        seen.add(key);
        found.push({
          text: line.trim().slice(0, 48),
          cut: cut[0],
          px: Math.round(cut[1] * 10) / 10,
          el: path(el),
          clip: path(c.n) + (c.scroll ? ' (scroller)' : ''),
          font: `${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${s.fontFamily.split(',')[0]}`,
        });
        break;
      }
    }
  }
  return found;
};
