// The design kit (#/kit): the type roles, the icons and every shared object in every state, on the game's
// own background. It is the reference the screens are built from and reviewed against.
import { KitObjects } from '../components/kit/KitObjects';
import { KitPlates } from '../components/kit/KitPlates';

export default function Kit() {
  return (
    <main className="kit" dir="rtl">
      <KitObjects />
      <KitPlates />
    </main>
  );
}
