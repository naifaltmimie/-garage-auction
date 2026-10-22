import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import { BidLog, Console } from '../components/Console';
import { LotSheet } from '../components/LotSheet';
import { ApprovalReveal, SoldReveal, UnsoldReveal } from '../components/Reveal';
import { timeLeft, useNow, type RoomView } from '../useRoom';

/** Ticks in the last seconds of an open lot. */
function useClosingTicks(room: RoomView) {
  const core = room.snap.core!;
  const now = useNow(room.offset, 8);
  const { ms } = timeLeft(core, now);
  const last = useRef(0);
  useEffect(() => {
    if (core.phase !== 'bidding' || core.paused || !core.bid) return;
    const s = Math.ceil(ms / 1000);
    if (s <= 3 && s >= 1 && s !== last.current) {
      last.current = s;
      sound.tick(s === 1);
    }
    if (s > 3) last.current = 0;
  }, [ms, core.phase, core.paused, core.bid]);
}

export function Auction({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const lot = room.snap.lot;
  const hist = room.snap.hist;
  const me = core.players.find((p) => p.id === room.myId);
  const [log, setLog] = useState(false);
  useClosingTicks(room);

  const sale = hist?.sales.length ? hist.sales[hist.sales.length - 1] : null;
  const saleForLot = sale && lot && sale.lotId === lot.id ? sale : null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [lot?.id]);

  if (!lot) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }
  return (
    <main className="auction">
      <div>
        <LotSheet
          lot={lot}
          total={core.lotsTotal}
          reserveMet={core.reserveMet}
          opening={core.opening}
          revealed={saleForLot && core.phase === 'sold' && lot.kind === 'covered' ? saleForLot.car : null}
        />
      </div>
      <Console room={room} me={me} onLog={() => setLog(true)} />
      {core.phase === 'sold' && saleForLot && saleForLot.buyer && <SoldReveal core={core} sale={saleForLot} myId={room.myId} offset={room.offset} />}
      {core.phase === 'unsold' && saleForLot && <UnsoldReveal core={core} sale={saleForLot} />}
      {core.phase === 'approval' && <ApprovalReveal core={core} />}
      {log && <BidLog core={core} myId={room.myId} onClose={() => setLog(false)} />}
    </main>
  );
}
