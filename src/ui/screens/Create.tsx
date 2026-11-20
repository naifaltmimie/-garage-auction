// Open a night: the host's name, the market in three rows, everything else folded under one optional row,
// and «افتح الصالة» always in thumb reach. With the defaults the room is open after the name and one tap.
import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import { loadMarket } from '../../data/market';
import { DEFAULT_SETTINGS } from '../../engine/rules';
import type { Settings } from '../../engine/types';
import { roomCode, store } from '../../lib/util';
import { go } from '../App';
import { Icon } from '../components/Bits';
import { Facts } from '../components/kit/Facts';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { MarketPicker, SettingsFields, settingsFacts } from '../components/SettingsFields';
import { createHostRoom } from '../useRoom';

export function Create() {
  const [name, setName] = useState(() => store.get('mzk:name', ''));
  const [s, setS] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [tried, setTried] = useState(false);
  const [open, setOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const [hadName] = useState(() => name.trim().length >= 2);
  const set = (p: Partial<Settings>) => setS((x) => ({ ...x, ...p }));
  const nameBad = name.trim().length < 2;
  // this phone is about to host: fetch the car market while the settings are being picked
  useEffect(() => {
    loadMarket().catch(() => {});
  }, []);

  const submit = () => {
    if (nameBad) {
      // the button stays live: a tap on it says what's missing instead of sitting there greyed out
      setTried(true);
      nameRef.current?.focus();
      return;
    }
    sound.unlock();
    const code = roomCode();
    createHostRoom(code, name.trim(), { ...s, roomName: s.roomName.trim() || `مزاد ${name.trim()}` });
    go(`/r/${code}`);
  };

  return (
    <main className="shell narrow lby-create">
      <div className="lby-top">
        <button type="button" className="lby-chalk lby-back" onClick={() => go('/')}>
          <Icon name="back" size={18} />
          رجوع
        </button>
      </div>
      <form
        className="lby-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <ScreenTitle caption="أنت الدلال، وتسوم مع الشباب بعد">افتح صالة</ScreenTitle>

        <label className="lby-name">
          <span className="lby-label">اسمك</span>
          <input
            ref={nameRef}
            className="lby-input"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلًا: نايف"
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="go"
            autoFocus={!hadName}
            aria-invalid={tried && nameBad}
            aria-describedby={tried && nameBad ? 'lby-name-err' : undefined}
          />
          <small id="lby-name-err" className="lby-err" role="alert">
            {tried && nameBad ? 'اكتب اسمك أول، حرفين على الأقل' : ''}
          </small>
        </label>

        <section className="lby-sec" aria-labelledby="lby-mk-h">
          <h2 className="lby-h" id="lby-mk-h">
            سوق الليلة
          </h2>
          <MarketPicker value={s.mix} set={set} />
        </section>

        <section className="lby-more">
          <button type="button" className="lby-more-btn" aria-expanded={open} aria-controls="lby-more-body" onClick={() => setOpen((x) => !x)}>
            <span className="lby-more-t">
              <b>تفاصيل المزاد (اختياري)</b>
              <Facts items={settingsFacts(s)} />
            </span>
            <span className="lby-more-ic" aria-hidden="true">
              <Icon name={open ? 'minus' : 'plus'} size={18} />
            </span>
          </button>
          {open && (
            <div className="lby-more-body" id="lby-more-body">
              <label className="lby-name lby-roomname">
                <span className="lby-label">اسم الصالة</span>
                <span className="lby-hint">يطلع للشباب فوق الصالة وعلى شاشة العرض</span>
                <input
                  className="lby-input"
                  value={s.roomName}
                  maxLength={28}
                  onChange={(e) => set({ roomName: e.target.value })}
                  placeholder={name.trim() ? `مزاد ${name.trim()}` : 'مزاد الليلة'}
                  autoComplete="off"
                  enterKeyHint="done"
                />
              </label>
              <SettingsFields s={s} set={set} />
            </div>
          )}
        </section>

        <div className="lby-bar">
          <div className="lby-bar-in">
            <button type="submit" className="btn btn-primary btn-block lby-go">
              افتح الصالة
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
