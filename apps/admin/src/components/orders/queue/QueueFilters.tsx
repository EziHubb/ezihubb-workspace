'use client';

import { EMPTY_FILTERS, type QueueFilterState, type ShipByBucket } from './types';

/**
 * The filter rail.
 *
 * Ship-by and destination are single-choice radios; the rest are independent
 * checkboxes, because an order can be a personalised gift with a note on it.
 * Filtering is server-side — the counts beside the tabs describe the whole
 * queue, not the page in front of you, and a client-side filter would quietly
 * disagree with them.
 */

const SHIP_BY: { value: ShipByBucket; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'overdue',  label: 'Overdue' },
  { value: 'today',    label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week',     label: 'Within a week' },
  { value: 'none',     label: 'No estimate' },
];

interface Props {
  value:        QueueFilterState;
  destinations: { country: string; count: number }[];
  onChange:     (next: QueueFilterState) => void;
}

export function QueueFilters({ value, destinations, onChange }: Props) {
  const set = <K extends keyof QueueFilterState>(key: K, v: QueueFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const isDirty = JSON.stringify(value) !== JSON.stringify(EMPTY_FILTERS);

  return (
    // w-full until lg, or the rail keeps its 240px inside a column layout and
    // leaves a ragged gutter beside every filter group.
    <aside className="w-full shrink-0 space-y-7 text-sm lg:w-60" aria-label="Filter orders">
      <fieldset>
        <legend className="mb-2 font-semibold text-secondary">Ship by date</legend>
        {SHIP_BY.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2 py-1 text-secondary">
            <input
              type="radio"
              name="shipBy"
              checked={value.shipBy === opt.value}
              onChange={() => set('shipBy', opt.value)}
              className="h-4 w-4"
            />
            {opt.label}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-secondary">Destination</legend>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-secondary">
          <input
            type="radio"
            name="destination"
            checked={value.destination === ''}
            onChange={() => set('destination', '')}
            className="h-4 w-4"
          />
          All
        </label>
        {destinations.map((d) => (
          <label key={d.country} className="flex cursor-pointer items-center gap-2 py-1 text-secondary">
            <input
              type="radio"
              name="destination"
              checked={value.destination === d.country}
              onChange={() => set('destination', d.country)}
              className="h-4 w-4"
            />
            <span className="flex-1">{d.country}</span>
            <span className="text-xs text-muted">{d.count}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-secondary">Order details</legend>
        <Check label="Has a note from the buyer" checked={value.hasNote}        onChange={(v) => set('hasNote', v)} />
        <Check label="Marked as a gift"          checked={value.isGift}         onChange={(v) => set('isGift', v)} />
        <Check label="Personalised"              checked={value.isPersonalized} onChange={(v) => set('isPersonalized', v)} />
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-secondary">Delivery</legend>
        <Check
          label="Upgrade requested"
          checked={value.upgradeRequested}
          onChange={(v) => set('upgradeRequested', v)}
        />
      </fieldset>

      <button
        type="button"
        onClick={() => onChange(EMPTY_FILTERS)}
        disabled={!isDirty}
        className="rounded-full bg-background px-4 py-2 text-sm font-medium text-secondary disabled:opacity-50"
      >
        Reset filters
      </button>
    </aside>
  );
}

function Check({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border"
      />
      {label}
    </label>
  );
}
