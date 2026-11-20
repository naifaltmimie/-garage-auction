// The design kit (#/kit): the type roles, the icons and every shared object in every state, on the game's
// own background. It is the reference the screens are built from and reviewed against.
import { KitObjects } from '../components/kit/KitObjects';

export default function Kit() {
  return (
    <main className="kit" dir="rtl">
      <KitObjects />
    </main>
  );
}
