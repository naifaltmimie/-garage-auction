import { color, font } from '../tokens';

const NEAR_BLACK = '#0D1117';
const HAIRLINE = '#4A4A44';

export function Plate({ amountText, bidderName }: { amountText: string; bidderName: string | null }) {
  return (
    <div dir="ltr" style={{ display: 'flex', maxWidth: 420, width: '100%', margin: '0 auto', background: color.plate, border: `2px solid ${NEAR_BLACK}`, borderRadius: 7, boxShadow: '0 6px 0 rgba(0,0,0,.45)', overflow: 'hidden', animation: 'stamp 280ms cubic-bezier(.2,1.6,.4,1)' }}>
      <div style={{ flex: '0 0 56px', background: color.band, borderInlineEnd: `2px solid ${NEAR_BLACK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '10px 0', color: '#FFFFFF' }}>
        <span style={{ fontFamily: font.num, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em' }}>KSA</span>
        <span style={{ fontFamily: font.body, fontSize: 10, opacity: 0.85 }}>مزاد</span>
      </div>
      <div style={{ flex: 1, padding: '12px 16px', minWidth: 0 }}>
        <div style={{ fontFamily: font.num, fontSize: 30, fontWeight: 600, lineHeight: 1.1, color: NEAR_BLACK, textAlign: 'center', letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums' }}>{amountText}</div>
        <div style={{ borderTop: '1px solid #C9C6BC', margin: '8px 0 6px' }} />
        <div dir="rtl" style={{ fontFamily: font.body, fontSize: 13, fontWeight: 500, color: HAIRLINE, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bidderName ?? 'ما فيه مزايدة بعد'}</div>
      </div>
    </div>
  );
}
