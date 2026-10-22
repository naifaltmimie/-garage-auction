import { carsN } from '../../lib/util';
import { GarageCard } from '../components/Garage';
import type { RoomView } from '../useRoom';

export function Showcase({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const sales = room.snap.hist?.sales ?? [];
  const active = core.players.filter((p) => !p.spectator);
  const sold = sales.filter((s) => s.buyer).length;
  return (
    <main className="shell" style={{ maxWidth: 1180 }}>
      <div className="stack" style={{ gap: 16 }}>
        <div style={{ textAlign: 'center' }} className="rise">
          <div className="t-label" style={{ color: 'var(--gold)' }}>نزلت المطرقة على آخر سيارة</div>
          <h1 className="t-display" style={{ fontSize: 'clamp(40px, 11vw, 62px)', margin: '4px 0' }}>عرض الكراجات</h1>
          <p className="mute" style={{ margin: 0 }}>
            انباعت {carsN(sold)}. شوفوا كل كراج زين، بعدها التقييم السري: كل واحد يقيّم كراجات الباقين ومحد يدري وش عطى.
          </p>
        </div>
        <div className="garages">
          {active.map((p, i) => (
            <div key={p.id} style={{ animationDelay: `${i * 0.12}s` }}>
              <GarageCard p={p} sales={sales} slots={core.settings.garage} me={p.id === room.myId} />
            </div>
          ))}
        </div>
        {room.host ? (
          <button className="btn btn-primary btn-block" style={{ minHeight: 62, fontSize: 20 }} onClick={active.length > 1 ? room.host.openVoting : room.host.finish}>
            {active.length > 1 ? 'ابدأ التقييم السري' : 'اعرض النتيجة'}
          </button>
        ) : (
          <div className="card" style={{ padding: 16, textAlign: 'center', fontWeight: 700 }}>
            الدلال بيفتح التقييم السري بعد شوي
          </div>
        )}
      </div>
    </main>
  );
}
