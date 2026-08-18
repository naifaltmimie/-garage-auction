import type { CSSProperties, ReactNode } from 'react';
import type { Tier } from '../types';
import { color, font, sar, tier as tierColor } from '../tokens';

export const TIER_AR: Record<Tier, string> = {
  luxury: 'فخمة', sport: 'رياضية', suv: 'دفع رباعي', daily: 'عادية', junk: 'زبالة',
};

export function Eyebrow({ children, latin, style }: { children: ReactNode; latin?: boolean; style?: CSSProperties }) {
  return <div style={{ fontFamily: latin ? font.num : font.body, fontSize: latin ? 12 : 12.5, fontWeight: 600, letterSpacing: latin ? '0.2em' : '0.02em', color: color.mute, ...style }}>{children}</div>;
}

type Surface = 'lot' | 'inset' | 'bare';
export function Panel({ children, surface = 'lot', style }: { children: ReactNode; surface?: Surface; style?: CSSProperties }) {
  const surfaces: Record<Surface, CSSProperties> = {
    lot: { background: color.panel, border: `1px solid ${color.line}`, borderRadius: 6 },
    inset: { background: color.panel2, border: '1px solid transparent', borderRadius: 6 },
    bare: { background: 'transparent', border: 'none' },
  };
  return <div style={{ ...surfaces[surface], ...style }}>{children}</div>;
}

export function TierPill({ t }: { t: Tier }) {
  const c = tierColor[t];
  return <span style={{ display: 'inline-block', fontFamily: font.body, fontSize: 13, fontWeight: 600, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '4px 14px', lineHeight: 1 }}>{TIER_AR[t]}</span>;
}

type ButtonVariant = 'primary' | 'ghost' | 'segment' | 'segmentOn';
export function Button({ children, onClick, disabled, variant = 'ghost', type = 'button', style, ariaLabel }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: ButtonVariant; type?: 'button' | 'submit'; style?: CSSProperties; ariaLabel?: string }) {
  const base: CSSProperties = { fontFamily: font.body, fontSize: 15, fontWeight: 600, minHeight: 44, padding: '0 16px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, transition: 'background .12s, border-color .12s, color .12s' };
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: { background: color.brass, color: color.ink, border: `1px solid ${color.brass}` },
    ghost: { background: 'transparent', color: color.text, border: `1px solid ${color.line}` },
    segment: { background: 'transparent', color: color.mute, border: `1px solid ${color.line}` },
    segmentOn: { background: color.brass, color: color.ink, border: `1px solid ${color.brass}` },
  };
  return <button type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

export function Money({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: CSSProperties }) {
  return <span style={{ fontFamily: font.num, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: muted ? color.mute : color.brass, ...style }}>{children}</span>;
}

export function Header({ code, budgetSar, filled, size, isHost }: { code: string; budgetSar?: number; filled?: number; size?: number; isHost?: boolean }) {
  return <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '0 0 12px', marginBottom: 18, borderBottom: `1px solid ${color.line}` }}>
    <span style={{ fontFamily: font.display, fontSize: 26, lineHeight: 1, color: color.text }}>مزاد الكراج</span>
    <span dir="ltr" style={{ fontFamily: font.num, fontSize: 14, fontWeight: 600, letterSpacing: '0.18em', color: color.brassSoft, border: `1px solid ${color.line}`, borderRadius: 4, padding: '5px 10px' }}>{code}</span>
    <div style={{ flex: 1 }} />
    {budgetSar != null && <span style={{ fontFamily: font.num, fontSize: 13, color: color.mute, fontVariantNumeric: 'tabular-nums' }}><Money>{sar(budgetSar)}</Money>{filled != null && size != null && ` · ${filled}/${size}`}</span>}
    {isHost && <span style={{ fontFamily: font.body, fontSize: 12, fontWeight: 600, color: color.brass }}>المدير</span>}
  </header>;
}

export function ConnectionBanner({ connection }: { connection: 'live' | 'reconnecting' | 'lost' }) {
  if (connection === 'live') return null;
  const lost = connection === 'lost';
  return <div role="status" style={{ fontFamily: font.body, fontSize: 13, textAlign: 'center', padding: '9px 12px', borderRadius: 6, marginBottom: 12, color: lost ? color.red : color.mute, border: `1px solid ${lost ? color.red : color.line}`, background: color.panel }}>{lost ? 'انقطع الاتصال — نحاول نرجّعك' : 'جاري إعادة الاتصال…'}</div>;
}
