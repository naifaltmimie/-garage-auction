import { useId } from 'react';
import type { Body } from '../../engine/types';

// Side profiles drawn for this game (front faces left, the direction Arabic reads).
// viewBox 0 0 320 120, ground at y=108.

interface Shape {
  body: string;
  glass: string[];
  wheels: [number, number];
  r: number;
  lines?: string[];
  head: [number, number];
  tail: [number, number];
}

const SHAPES: Record<Body, Shape> = {
  sedan: {
    body: 'M24 98 C17 97 15 92 16 84 L18 76 C19 71 24 68 31 67 L92 60 C104 59 112 55 121 49 L143 37 C150 33 158 32 168 32 L206 32 C216 32 224 35 231 41 L251 57 C256 61 262 62 270 63 L294 66 C300 67 303 71 303 77 L303 89 C303 94 300 98 294 98 L268 98 A26 26 0 0 0 216 98 L104 98 A26 26 0 0 0 52 98 Z',
    glass: ['M121 58 L144 41 C150 37 156 36 163 36 L174 36 L174 58 Z', 'M180 36 L205 36 C213 36 219 39 225 44 L240 57 L180 58 Z'],
    wheels: [78, 242],
    r: 21,
    lines: ['M176 60 L176 94', 'M118 62 C116 75 114 86 112 94', 'M252 62 C252 74 251 86 249 94'],
    head: [24, 74],
    tail: [298, 72],
  },
  suv: {
    body: 'M22 100 C15 99 13 94 14 86 L15 70 C16 63 21 59 28 58 L90 52 C100 51 106 47 112 41 L128 26 C132 22 138 20 146 20 L274 20 C284 20 290 23 294 30 L302 46 C304 51 305 57 305 64 L305 90 C305 96 301 100 294 100 L272 100 A28 28 0 0 0 216 100 L106 100 A28 28 0 0 0 50 100 Z',
    glass: ['M114 52 L131 32 C135 27 139 25 146 25 L180 25 L180 52 Z', 'M186 25 L238 25 L238 52 L186 52 Z', 'M244 25 L272 25 C280 25 285 28 288 34 L296 50 L244 52 Z'],
    wheels: [78, 244],
    r: 23,
    lines: ['M183 55 L183 96', 'M241 55 L241 96', 'M112 56 C110 72 109 86 108 96'],
    head: [20, 66],
    tail: [300, 56],
  },
  pickup: {
    body: 'M22 100 C15 99 13 94 14 86 L15 70 C16 63 21 59 28 58 L88 53 C98 52 104 48 110 42 L126 27 C130 23 136 21 144 21 L192 21 C200 21 205 25 207 32 L210 54 L300 54 C304 54 306 57 306 61 L306 90 C306 96 302 100 295 100 L272 100 A28 28 0 0 0 216 100 L106 100 A28 28 0 0 0 50 100 Z',
    glass: ['M112 52 L129 33 C133 28 137 26 144 26 L162 26 L162 52 Z', 'M168 26 L191 26 C197 26 200 29 201 34 L203 52 L168 52 Z'],
    wheels: [78, 244],
    r: 23,
    lines: ['M165 55 L165 96', 'M212 58 L212 96', 'M214 60 L300 60'],
    head: [20, 66],
    tail: [302, 62],
  },
  coupe: {
    body: 'M24 98 C17 97 15 93 16 86 L18 78 C20 72 25 70 32 69 L98 62 C112 60 122 54 132 46 L150 36 C158 32 166 30 178 30 L204 31 C214 32 224 36 234 44 L262 62 C268 66 276 67 286 68 L296 70 C301 71 304 75 304 80 L304 90 C304 95 301 98 295 98 L268 98 A26 26 0 0 0 216 98 L104 98 A26 26 0 0 0 52 98 Z',
    glass: ['M132 58 L152 42 C159 37 166 35 176 35 L200 36 C209 37 217 40 225 46 L240 58 Z'],
    wheels: [78, 242],
    r: 21,
    lines: ['M190 60 C190 72 189 86 188 94'],
    head: [24, 76],
    tail: [298, 74],
  },
  hatch: {
    body: 'M30 98 C23 97 21 92 22 85 L24 77 C25 72 30 69 37 68 L92 61 C104 59 112 55 122 47 L140 35 C147 31 154 30 163 30 L232 30 C242 30 248 34 252 41 L264 64 C266 69 267 74 267 80 L267 90 C267 95 264 98 258 98 L246 98 A25 25 0 0 0 196 98 L104 98 A25 25 0 0 0 54 98 Z',
    glass: ['M122 58 L142 40 C148 35 154 34 162 34 L176 34 L176 58 Z', 'M182 34 L228 34 C236 34 241 37 244 43 L251 58 L182 58 Z'],
    wheels: [79, 221],
    r: 20,
    lines: ['M179 60 L179 94', 'M118 62 C116 75 114 86 112 94'],
    head: [28, 74],
    tail: [263, 70],
  },
  van: {
    body: 'M22 100 C15 99 13 94 14 86 L15 70 C16 63 20 59 27 57 L60 50 C68 48 72 43 76 36 L86 18 C90 12 96 10 104 10 L286 10 C296 10 302 15 303 24 L305 90 C305 96 301 100 294 100 L272 100 A28 28 0 0 0 216 100 L104 100 A28 28 0 0 0 48 100 Z',
    glass: ['M78 48 L90 24 C93 18 97 16 104 16 L128 16 L128 48 Z', 'M134 16 L184 16 L184 48 L134 48 Z', 'M190 16 L240 16 L240 48 L190 48 Z', 'M246 16 L290 16 C295 16 297 19 297 24 L298 48 L246 48 Z'],
    wheels: [76, 244],
    r: 23,
    lines: ['M131 52 L131 96', 'M187 52 L187 96'],
    head: [20, 66],
    tail: [301, 40],
  },
  convertible: {
    body: 'M24 98 C17 97 15 93 16 86 L18 78 C20 72 25 70 32 69 L104 62 C112 61 118 58 124 54 L140 44 L146 46 L136 58 L238 58 C246 58 252 60 260 63 L286 68 C298 70 304 74 304 80 L304 90 C304 95 301 98 295 98 L268 98 A26 26 0 0 0 216 98 L104 98 A26 26 0 0 0 52 98 Z',
    glass: ['M128 56 L142 46 L144 47 L134 57 Z'],
    wheels: [78, 242],
    r: 21,
    lines: ['M188 62 C188 74 187 86 186 94', 'M150 58 L232 58'],
    head: [24, 76],
    tail: [298, 74],
  },
  wagon: {
    body: 'M24 98 C17 97 15 92 16 84 L18 76 C19 71 24 68 31 67 L92 60 C104 59 112 55 121 49 L143 37 C150 33 158 32 168 32 L272 32 C282 32 288 36 292 43 L300 60 C302 64 303 69 303 75 L303 89 C303 94 300 98 294 98 L268 98 A26 26 0 0 0 216 98 L104 98 A26 26 0 0 0 52 98 Z',
    glass: ['M121 58 L144 41 C150 37 156 36 163 36 L174 36 L174 58 Z', 'M180 36 L232 36 L232 58 L180 58 Z', 'M238 36 L270 36 C278 36 283 39 286 45 L292 58 L238 58 Z'],
    wheels: [78, 242],
    r: 21,
    lines: ['M176 60 L176 94', 'M235 60 L235 94'],
    head: [24, 74],
    tail: [298, 66],
  },
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function Silhouette({ body, color = '#d9d4c8', mono = false, damaged = false }: { body: Body; color?: string; mono?: boolean; damaged?: boolean }) {
  const id = useId().replace(/:/g, '');
  const s = SHAPES[body] ?? SHAPES.sedan;
  const light = shade(color, 34);
  const dark = shade(color, -46);
  const stroke = mono ? 'rgba(28,24,20,.55)' : shade(color, -90);
  return (
    <svg viewBox="0 0 320 120" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`p${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset=".48" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6f7a82" />
          <stop offset=".5" stopColor="#1e2328" />
          <stop offset="1" stopColor="#0d1013" />
        </linearGradient>
        <radialGradient id={`w${id}`}>
          <stop offset="0" stopColor="#d8d8d4" />
          <stop offset=".62" stopColor="#8d8f8f" />
          <stop offset="1" stopColor="#3e4142" />
        </radialGradient>
      </defs>
      <ellipse cx="160" cy="110" rx="150" ry="5" fill="rgba(0,0,0,.28)" />
      <path d={s.body} fill={mono ? 'rgba(28,24,20,.12)' : `url(#p${id})`} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      {s.glass.map((g, i) => (
        <path key={i} d={g} fill={mono ? 'rgba(28,24,20,.25)' : `url(#g${id})`} stroke={stroke} strokeWidth=".8" />
      ))}
      {s.lines?.map((l, i) => (
        <path key={i} d={l} fill="none" stroke={stroke} strokeWidth=".9" opacity=".55" />
      ))}
      <path d={`M${s.head[0] - 4} ${s.head[1] - 3} l10 -1 l1 6 l-10 1 z`} fill={mono ? 'rgba(28,24,20,.3)' : '#f7f2df'} opacity=".9" />
      <path d={`M${s.tail[0] - 4} ${s.tail[1] - 3} l6 0 l0 8 l-6 0 z`} fill={mono ? 'rgba(28,24,20,.3)' : '#b3261e'} opacity=".95" />
      {s.wheels.map((x) => (
        <g key={x}>
          <circle cx={x} cy={108 - s.r} r={s.r} fill="#121212" />
          <circle cx={x} cy={108 - s.r} r={s.r * 0.62} fill={mono ? 'rgba(28,24,20,.35)' : `url(#w${id})`} />
          {[0, 72, 144, 216, 288].map((a) => (
            <line
              key={a}
              x1={x}
              y1={108 - s.r}
              x2={x + Math.cos((a * Math.PI) / 180) * s.r * 0.56}
              y2={108 - s.r + Math.sin((a * Math.PI) / 180) * s.r * 0.56}
              stroke="#2b2d2e"
              strokeWidth="2.2"
            />
          ))}
          <circle cx={x} cy={108 - s.r} r={s.r * 0.15} fill="#2b2d2e" />
        </g>
      ))}
      {damaged && (
        <g stroke="#b3261e" strokeWidth="2" fill="none" opacity=".8">
          <path d="M26 70 l8 6 l-6 4 l9 5" />
        </g>
      )}
    </svg>
  );
}
