import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Structural assertions over the source, not a render: this project has no jsdom or
// testing-library, and adding them is a larger change than these checks warrant. They
// are honest about what they cover — the wiring, which is what has actually regressed.
const source = readFileSync(
  resolve(__dirname, '../ReservationDialog.tsx'), 'utf8',
);

// The deposit block, so an assertion about the amount input cannot accidentally match
// some other numeric field in the dialog.
// Comments are stripped before matching. Without this the first assertion found
// step="0.50" inside the comment EXPLAINING why 0.50 was wrong, and reported the bug
// as still present after it was fixed. A test that reads prose as code is the same
// trap as one that matches an import line instead of a call.
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const depositBlock = stripComments(
  source.slice(
    source.indexOf('id="deposit-amount"'),
    source.indexOf('id="deposit-amount"') + 1200,
  ),
);

describe('ReservationDialog — deposit controls', () => {
  it('allows any two-decimal amount the backend accepts', () => {
    // The input sits inside a native form, so the browser enforces step alignment.
    // step="0.50" rejected 10.10 and 18.75 with a stepMismatch — amounts the backend
    // explicitly supports, its column being DECIMAL(10,2). The minimum is the real
    // guard; the step is only a spinner increment.
    const step = depositBlock.match(/step="([^"]+)"/)?.[1];
    expect(step).toBeDefined();

    const allowsTwoDecimals = step === 'any' || Number(step) <= 0.01;
    expect(
      allowsTwoDecimals,
      `step="${step}" blocks valid amounts such as 10.10 or 18.75`,
    ).toBe(true);
  });

  it('keeps a per-person minimum so the total clears Stripe floor', () => {
    // Stripe's minimum applies to the TOTAL. A per-person floor of 0.50 keeps even a
    // party of one above it, which is why the server-side refusal stays unreachable
    // in normal use.
    const min = Number(depositBlock.match(/min="([^"]+)"/)?.[1]);
    expect(min).toBeGreaterThanOrEqual(0.5);
  });

  it('renders nothing about deposits when the restaurant cannot take one', () => {
    // A box that cannot work invites staff to tick it and then wonder why nothing
    // happened, so availability gates the whole block rather than disabling the input.
    expect(source).toContain('depositAvailable && (');
    expect(source).toMatch(/depositAvailable\s*=[^;]*payments_available/);
  });

  it('excludes walk-ins and edits from the deposit flow', () => {
    // A walk-in is already at the door; an edit is out of scope for this phase.
    expect(source).toMatch(/depositAvailable\s*=\s*!isWalkIn\s*&&\s*!reservation/);
  });

  it('does not overwrite an amount staff have typed', () => {
    expect(source).toContain('depositTouched');
    expect(source).toMatch(/if \(!depositAvailable \|\| depositTouched\) return;/);
  });

  it('reports a failed deposit separately from a created booking', () => {
    // The backend returns 201 when the booking saved and only the deposit failed, so
    // without saying so explicitly staff would read "reservation created" and believe
    // a deposit was requested.
    expect(source).toContain('payment_error');
    expect(source).toContain('createdButDepositFailed');
  });

  it('never claims a WhatsApp delivery that did not happen', () => {
    expect(source).toContain('payment_link_sent');
    expect(source).toContain('depositLinkNotSent');
  });
});
