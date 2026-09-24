const toMinutes = (time: string | null | undefined): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/**
 * The time a new booking should show, always one the day offers.
 *
 * The preferred time (the calendar cell staff clicked) when it is on the list,
 * otherwise the nearest offered time — the earlier one on a tie — and the first one
 * when there is no usable preference. Assumes a non-empty list.
 */
export function pickOfferedTime(offered: string[], preferred: string | null | undefined): string {
  if (preferred && offered.includes(preferred)) return preferred;
  const target = toMinutes(preferred);
  if (target === null) return offered[0];
  let best = offered[0];
  let bestGap = Infinity;
  for (const time of offered) {
    const minutes = toMinutes(time);
    if (minutes === null) continue;
    const gap = Math.abs(minutes - target);
    if (gap < bestGap) {
      best = time;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Minutes from start to end, an end at or before the start being the next day
 * (22:00–01:00 is three hours). The capacity preview and the save both use this, so
 * the warning is about the same booking that gets stored. Undefined if either time
 * cannot be read.
 */
export function stayMinutes(start: string | null | undefined, end: string | null | undefined): number | undefined {
  const from = toMinutes(start);
  let to = toMinutes(end);
  if (from === null || to === null) return undefined;
  if (to <= from) to += 24 * 60;
  return to - from;
}
