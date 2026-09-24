import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pickOfferedTime } from '../reservationTime';

// Found in the Codex review, 2026-09-24: a booking opened from a calendar cell whose
// time the day's sittings do not offer kept that time anyway — the dialog put the
// same invalid default back — so the dropdown showed nothing selected and the save
// failed the backend's fixed-sitting check.
describe('pickOfferedTime', () => {
  const sittings = ['13:00', '14:30', '20:00', '22:00'];

  it('keeps the preferred time when the day offers it', () => {
    expect(pickOfferedTime(sittings, '14:30')).toBe('14:30');
  });

  it('moves a time the day does not offer to the nearest sitting', () => {
    expect(pickOfferedTime(sittings, '21:15')).toBe('22:00');
    expect(pickOfferedTime(sittings, '20:30')).toBe('20:00');
    expect(pickOfferedTime(sittings, '13:30')).toBe('13:00');
  });

  it('breaks a tie towards the earlier sitting', () => {
    expect(pickOfferedTime(['20:00', '22:00'], '21:00')).toBe('20:00');
  });

  it('falls back to the first sitting with no preference, or an unreadable one', () => {
    expect(pickOfferedTime(sittings, null)).toBe('13:00');
    expect(pickOfferedTime(sittings, '')).toBe('13:00');
    expect(pickOfferedTime(sittings, 'soon')).toBe('13:00');
  });

  it('never returns a time outside the list', () => {
    for (const preferred of ['00:00', '09:45', '16:00', '23:59', '12:59']) {
      expect(sittings).toContain(pickOfferedTime(sittings, preferred));
    }
  });
});

describe('ReservationDialog uses it when correcting the time', () => {
  // Structural: the dialog cannot be rendered here (no jsdom).
  const source = readFileSync(resolve(__dirname, '../../components/ReservationDialog.tsx'), 'utf8');
  it('does not put an unoffered default time back', () => {
    expect(source).toContain('setReservationTime(pickOfferedTime(availableTimeSlots, defaultTime))');
    expect(source).not.toContain('setReservationTime(defaultTime || availableTimeSlots[0])');
  });
});
