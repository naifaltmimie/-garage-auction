import { carsN } from '../../lib/util';
import { GarageCard } from '../components/Garage';
import { ActionBar } from '../components/kit/ActionBar';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { TireLoader } from '../components/TireLoader';
import type { RoomView } from '../useRoom';

/** عرض الكراجات: every garage as a ruled group, then the host opens the secret rating. */
export function Showcase({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const sales = room.snap.hist?.sales ?? [];
  const active = core.players.filter((p) => !p.spectator);
  const sold = sales.filter((s) => s.buyer).length;
  const host = core.players.find((p) => p.host);
  // my garage first, then the rest in paddle order
  const order = [...active].sort((a, b) => Number(b.id === room.myId) - Number(a.id === room.myId) || a.paddle - b.paddle);
  return (
    <main className="shell e-page e-showcase">
      <ScreenTitle caption={`${sold ? `انباعت ${carsN(sold)}.` : 'ما انباعت ولا سيارة.'} الربح هنا من القيم اللي انكشفت بعد كل بيعة. التقييم السري يجي بالأخير.`}>
        عرض الكراجات
      </ScreenTitle>
      <div className="e-groups">
        {order.map((p) => (
          <GarageCard key={p.id} p={p} sales={sales} slots={core.settings.garage} me={p.id === room.myId} />
        ))}
      </div>
      {room.host ? (
        <ActionBar label="التقييم السري">
          <button className="btn btn-primary btn-block e-go" onClick={active.length > 1 ? room.host.openVoting : room.host.finish}>
            {active.length > 1 ? 'ابدأ التقييم السري' : 'اعرض النتيجة'}
          </button>
        </ActionBar>
      ) : (
        <ActionBar label="الحالة">
          <div className="e-wait">
            <TireLoader size={36} />
            <span>
              ننتظر <b>{host?.name ?? 'الدلال'}</b> يفتح التقييم السري
            </span>
          </div>
        </ActionBar>
      )}
    </main>
  );
}
