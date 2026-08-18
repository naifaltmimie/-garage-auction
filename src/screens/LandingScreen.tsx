import { useState } from 'react';
import type { ScreenProps } from '../types';
import { color, font } from '../tokens';
import { Button } from '../components/atoms';

export default function LandingScreen({ actions }: ScreenProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const open = () => { if (!name.trim()) return setError('اكتب اسمك أول'); setError(''); actions.createRoom(name.trim()); };
  const join = () => { if (!name.trim()) return setError('اكتب اسمك أول'); if (code.trim().length !== 4) return setError('الكود أربع خانات'); setError(''); actions.joinRoom(code.trim().toUpperCase(), name.trim()); };
  return <div style={{ maxWidth: 560, margin: '0 auto', padding: '9vh 16px 60px' }}>
    <div style={{ textAlign: 'center', marginBottom: 30 }}><div dir="ltr" style={{ fontFamily: font.num, fontSize: 11, fontWeight: 600, letterSpacing: '0.3em', color: color.brass }}>LOT 001</div><h1 style={{ fontFamily: font.display, fontWeight: 900, fontSize: 'clamp(46px, 14vw, 84px)', lineHeight: 1, margin: '10px 0 12px', color: color.text }}>مزاد الكراج</h1><p style={{ margin: 0, fontFamily: font.body, fontSize: 14, color: color.mute, lineHeight: 1.8 }}>كل واحد عنده ميزانية وكراج فاضي. السيارات تجي عشوائي، وتزاودون عليها.<br />وبعد ما تكتمل الكراجات — تنكشف الفئة، ويجي التقييم.</p></div>
    <div style={{ background: color.panel, border: `1px solid ${color.line}`, borderRadius: 6, padding: 20 }}>
      <label style={{ fontFamily: font.body, fontSize: 12.5, fontWeight: 600, color: color.mute }}>اسمك</label>
      <input value={name} onChange={(e) => { setName(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && open()} placeholder="نايف" maxLength={14} style={{ ...field, margin: '8px 0 18px' }} />
      <Button variant="primary" onClick={open} style={{ width: '100%', fontSize: 16 }}>افتح غرفة جديدة</Button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}><span style={{ flex: 1, height: 1, background: color.line }} /><span style={{ fontFamily: font.body, fontSize: 12, color: color.mute }}>أو انضم</span><span style={{ flex: 1, height: 1, background: color.line }} /></div>
      <div style={{ display: 'flex', gap: 8 }}><input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && join()} placeholder="ABCD" maxLength={4} dir="ltr" aria-label="كود الغرفة" style={{ ...field, flex: 1, fontFamily: font.num, fontSize: 20, letterSpacing: '0.22em', textAlign: 'center' }} /><Button onClick={join} style={{ flex: '0 0 auto' }}>دخول</Button></div>
      {error && <p role="alert" style={{ margin: '12px 0 0', fontFamily: font.body, fontSize: 13, color: color.red }}>{error}</p>}
    </div>
    <p style={{ textAlign: 'center', fontFamily: font.body, fontSize: 11.5, color: color.mute, marginTop: 20 }}>من ٢ إلى ٨ لاعبين · مدير الغرفة يلزم يخلي الصفحة مفتوحة أثناء اللعب</p>
  </div>;
}

const field: React.CSSProperties = { width: '100%', minHeight: 44, background: color.ink, border: `1px solid ${color.line}`, borderRadius: 4, padding: '0 14px', fontFamily: font.body, fontSize: 16, color: color.text };
