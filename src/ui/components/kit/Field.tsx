// A settings row: the visible Arabic label (with an optional hint under it), then the control on its own line.
// Inside a .field the segmented control, the stepper and the switch read as one family (kit.css): a sunk
// rubber track, the chosen thumb in white paper with black text, 44px tall, numbers in print.
import { useId, type ReactNode } from 'react';
import { Icon } from '../Bits';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field kit-field" role="group" aria-labelledby={`${id}-l`}>
      <div className="kf-head">
        <span className="kf-label" id={`${id}-l`}>
          {label}
        </span>
        {hint && <span className="kf-hint">{hint}</span>}
      </div>
      <div className="kf-ctl">{children}</div>
    </div>
  );
}

/** The segmented control. `print` sets the option labels as printed numbers. */
export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  print,
}: {
  options: { v: T; label: ReactNode; aria?: string }[];
  value: T;
  onChange: (v: T) => void;
  print?: boolean;
}) {
  return (
    <div className={print ? 'seg seg-print' : 'seg'}>
      {options.map((o) => (
        <button type="button" key={String(o.v)} aria-pressed={o.v === value} aria-label={o.aria} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The stepper: two rubber knobs either side of the value on paper. */
export function Stepper({
  value,
  onDec,
  onInc,
  canDec = true,
  canInc = true,
}: {
  value: ReactNode;
  onDec: () => void;
  onInc: () => void;
  canDec?: boolean;
  canInc?: boolean;
}) {
  return (
    <div className="stepper">
      <button type="button" onClick={onDec} disabled={!canDec} aria-label="أقل">
        <Icon name="minus" size={18} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={onInc} disabled={!canInc} aria-label="أكثر">
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

/** The switch, with its state said in words beside it. */
export function Switch({
  on,
  onChange,
  label,
  onText = 'شغّال',
  offText = 'طافي',
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  onText?: string;
  offText?: string;
}) {
  return (
    <button type="button" className="kit-switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className="switch" aria-hidden="true" />
      <span className="kit-switch-t">{on ? onText : offText}</span>
    </button>
  );
}
