export const color = {
  ink: '#0D1117',
  panel: '#161B23',
  panel2: '#1D2430',
  line: '#2A3341',
  text: '#E8E6E1',
  mute: '#8B94A3',
  brass: '#C8952B',
  brassSoft: '#E0B75A',
  plate: '#F2F0EA',
  band: '#1F4E9C',
  red: '#D8412F',
  green: '#2E9E6B',
} as const;

export const tier = {
  luxury: '#C8952B',
  sport: '#C05CC0',
  suv: '#4E93D8',
  daily: '#8B94A3',
  junk: '#7B5E3B',
} as const;

export const font = {
  display: "Georgia, 'Times New Roman', serif",
  body: "Tahoma, Arial, system-ui, sans-serif",
  num: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

export const radius = {
  control: '4px',
  panel: '6px',
  pill: '999px',
} as const;

const NF = new Intl.NumberFormat('en-US');
export function sar(n: number): string {
  return NF.format(Math.round(n));
}
