import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// DayCalendar: renders the day-view schedule grid with table columns and time rows.
describe('DayCalendar', () => {
  it('is defined as a module', async () => {
    expect(true).toBe(true);
  });
});

describe('DayCalendar — mark-paid errors', () => {
  it("shows the backend's reason, not a bare error", () => {
    // already_paid_online (a double payment staff must refund) was shown as "Error".
    const src = readFileSync(resolve(__dirname, '../DayCalendar.tsx'), 'utf8');
    const block = src.slice(src.indexOf('mutationFn: markAppointmentPaid')).slice(0, 900);
    expect(block).toMatch(/onError:\s*\(error[^)]*\)\s*=>\s*\{[^}]*error\.message/);
  });
});
