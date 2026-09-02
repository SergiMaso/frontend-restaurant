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

describe('ReservationDialog — arrival cap warning', () => {
  const clean = stripComments(source);

  it('asks the backend what the cap says', () => {
    expect(clean).toContain('getSlotCapacity(');
    expect(clean).toMatch(/queryKey:\s*useTenantKey\(\[\s*\n?\s*"slot-capacity"/);
  });

  it('never blocks the save', () => {
    // Staff exceed the cap deliberately; the warning is information, not validation.
    // A disabled submit here would take away the override the backend deliberately
    // allows, and staff would have no way to seat the party at all.
    const footer = clean.slice(clean.indexOf('type="submit"') - 400,
                               clean.indexOf('type="submit"') + 200);
    expect(footer).not.toContain('capWarning &&  disabled');
    expect(clean).toMatch(/disabled=\{updateMutation\.isPending \|\| configLoading\}/);
    expect(clean).not.toMatch(/disabled=\{[^}]*capWarning/);
  });

  it('says nothing when this booking is not the one going over', () => {
    // A slot that is merely busy is the restaurant's normal state. Warning every time
    // trains staff to click past the warning that matters.
    // Wide enough to reach the last branch: this block has grown every time a new
    // outcome was added, and a fixed window silently stops covering the newest one.
    // To the end of the whole expression, not a fixed window and not the first
    // `return null;` — that one is the guard on the first line.
    const block = clean.slice(clean.indexOf('const capWarning'),
                              clean.indexOf('})();', clean.indexOf('const capWarning')));
    expect(block).toContain('would_exceed');
    expect(block).toContain('overflow');
    expect(block).toMatch(/return null;/);
  });

  it('stays quiet when the cap could not be read', () => {
    // Failing to warn must not become failing to book.
    const block = clean.slice(clean.indexOf('const capWarning'),
                              clean.indexOf('const capWarning') + 400);
    expect(block).toContain('unavailable');
  });

  it('puts the warning where the person clicking will see it', () => {
    const submitAt = clean.indexOf('type="submit"');
    const warningAt = clean.indexOf('{capWarning && (');
    expect(warningAt).toBeGreaterThan(0);
    expect(warningAt).toBeLessThan(submitAt);
    expect(submitAt - warningAt).toBeLessThan(1200);
  });
});

describe('ReservationDialog — the cap warning asks about the right booking', () => {
  const clean = stripComments(source);
  const capBlock = clean.slice(clean.indexOf('const [walkInNow'),
                               clean.indexOf('const capWarning'));

  it('asks about the time a walk-in will actually be booked at', () => {
    // The submit handler builds a walk-in's date and time from the clock, not from
    // reservationTime. Asking about reservationTime warned about a slot the booking
    // never touches — and stayed silent about the one it does.
    // Anchored on the payload rather than a byte window after walkInTime: the window
    // silently stopped short of the line it was meant to check.
    const payloadAt = clean.indexOf('const dataToSend');
    expect(payloadAt).toBeGreaterThan(0);
    const submit = clean.slice(payloadAt, payloadAt + 500);
    expect(submit).toContain('isWalkIn ? walkInTime : reservationTime');
    expect(capBlock).toContain('isWalkIn ? format(walkInNow');
    expect(capBlock).toMatch(/getHours\(\)[\s\S]*getMinutes\(\)/);
  });

  it('re-reads the clock while a walk-in dialog stays open', () => {
    // Typed at 13:29 and confirmed at 13:31 is a different slot.
    expect(capBlock).toContain('setInterval');
    expect(capBlock).toContain('clearInterval');
  });

  it('does not count an edited booking against itself', () => {
    // Moving a party of 6 inside a slot that holds those very 6 would report nothing
    // left and warn every time — worse than not warning, because staff stop reading it.
    expect(capBlock).toContain('reservation?.id');
    expect(capBlock).toMatch(/getSlotCapacity\(capDate, capTime, peopleForTerms, reservation\?\.id/);
  });

  it('keys the query on everything the answer depends on', () => {
    // A stale answer is a wrong warning: change the party size or the booking being
    // edited and the previous slot's numbers would otherwise stay on screen.
    const key = capBlock.slice(capBlock.indexOf('queryKey'), capBlock.indexOf('queryFn'));
    for (const part of ['capDate', 'capTime', 'peopleForTerms', 'reservation?.id']) {
      expect(key).toContain(part);
    }
  });
});

describe('ReservationDialog — a booking that fits no sitting', () => {
  const clean = stripComments(source);
  const block = clean.slice(clean.indexOf('const capWarning'),
                            clean.indexOf('const capWarning') + 1400);

  it('says which sitting it lands on and by how much', () => {
    // Staff can save it, so the sentence has to name the price: the nearest sitting
    // goes over its cap rather than the party going uncounted.
    expect(block).toContain('slotCapacity.overflow');
    expect(block).toContain('reservations.capOverflow');
    expect(block).toContain('slotCapacity.over_by');
    expect(block).toContain('slotCapacity.assigned');
  });

  it('checks it before the plain over-cap case', () => {
    // Both set would_exceed, so the generic message would swallow the specific one and
    // staff would be told "the sitting is full" about a time that is not a sitting.
    expect(block.indexOf('slotCapacity.overflow'))
      .toBeLessThan(block.indexOf('slotCapacity.would_exceed'));
  });
});

describe('ReservationDialog — the time it opens on', () => {
  const clean = stripComments(source);

  it('opens on a slot the restaurant actually offers', () => {
    // The initial state already used availableTimeSlots[0]; the reset that runs every
    // time the dialog opens hardcoded 20:00. In fixed mode the dropdown lists only the
    // configured sittings, so a restaurant doing lunch at 13:00 and 14:30 opened this
    // showing a time absent from its own list — and saving without touching it booked
    // off-slot, which the arrival cap then has to treat as a deliberate override.
    const reset = clean.slice(clean.indexOf('Nova reserva'),
                              clean.indexOf('Nova reserva') + 700);
    expect(reset).toContain('setReservationTime(defaultTime || availableTimeSlots[0]');
  });

  it('keeps a fallback for a restaurant with no slots configured at all', () => {
    const reset = clean.slice(clean.indexOf('Nova reserva'),
                              clean.indexOf('Nova reserva') + 700);
    expect(reset).toMatch(/availableTimeSlots\[0\] \|\| "20:00"/);
  });

  it('offers only the configured sittings in fixed mode', () => {
    // Why no extra highlighting was added: in fixed mode the list IS the fixed slots,
    // so there is nothing to distinguish them from.
    const generator = clean.slice(clean.indexOf('const generateTimeSlots'),
                                  clean.indexOf('const generateTimeSlots') + 500);
    expect(generator).toContain("if (mode === 'fixed')");
    expect(generator).toMatch(/return \[\.\.\.lunchSlots, \.\.\.dinnerSlots\]/);
  });
});

describe('ReservationDialog — the time survives config arriving late', () => {
  const clean = stripComments(source);

  it('corrects the time once the real slots load', () => {
    // The reset does not wait for the restaurant config, so the dialog first computes
    // its slot list from whatever the hook returns while loading and can settle on a
    // provisional 12:00 or 20:00. In fixed mode the backend rejects any time outside
    // the configured sittings, so that value does not merely look odd — the save fails.
    expect(clean).toMatch(/if \(availableTimeSlots\.includes\(reservationTime\)\) return;/);
    expect(clean).toContain('availableTimeSlots.join(\',\')');
  });

  it('waits for the config instead of acting on a provisional list', () => {
    const effect = clean.slice(clean.indexOf('if (!open || reservation || configLoading)'),
                               clean.indexOf('if (!open || reservation || configLoading)') + 320);
    expect(effect).toContain('configLoading');
    expect(effect).toContain('!availableTimeSlots.length');
  });

  it('never moves a time staff chose themselves', () => {
    const effect = clean.slice(clean.indexOf('if (!open || reservation || configLoading)'),
                               clean.indexOf('if (!open || reservation || configLoading)') + 320);
    expect(effect).toContain('availableTimeSlots.includes(reservationTime)');
  });

  it('leaves an existing booking alone', () => {
    // A booking made before the sittings were configured may sit off-slot; snapping it
    // would silently reschedule somebody.
    const effect = clean.slice(clean.indexOf('if (!open || reservation || configLoading)'),
                               clean.indexOf('if (!open || reservation || configLoading)') + 320);
    expect(effect).toMatch(/!open \|\| reservation \|\| configLoading/);
  });
});

describe('ReservationDialog — a time the save will reject', () => {
  const clean = stripComments(source);
  const block = clean.slice(clean.indexOf('const capWarning'),
                            clean.indexOf('const capWarning') + 1800);

  it('says the save will fail rather than warning about capacity', () => {
    // "You can save it, the sitting will be 4 over" was said about a time the backend
    // rejects outright. Staff would click and get a bare 400.
    expect(block).toContain('slotCapacity.bookable === false');
    expect(block).toContain('reservations.capNotASitting');
  });

  it('checks it before the capacity messages it would contradict', () => {
    // How full a sitting is has nothing to say about a time that is not a sitting.
    // Only the walk-in branch may come first, because a walk-in IS saved — it is moved
    // onto a sitting, so "the save will fail" would be the wrong thing to say.
    const notASitting = block.indexOf('slotCapacity.bookable === false');
    expect(notASitting).toBeGreaterThan(-1);
    expect(notASitting).toBeLessThan(block.indexOf('slotCapacity.would_exceed'));
    expect(block.indexOf('slotCapacity.snapped_from')).toBeLessThan(notASitting);
  });

  it('names the times that would work', () => {
    expect(block).toContain('slotCapacity.sittings');
  });
});

describe('ReservationDialog — a walk-in moved onto a sitting', () => {
  const clean = stripComments(source);
  const block = clean.slice(clean.indexOf('const capWarning'),
                            clean.indexOf('const capWarning') + 2200);

  it('asks about the sitting the walk-in will land on', () => {
    expect(clean).toMatch(/getSlotCapacity\(capDate, capTime, peopleForTerms, reservation\?\.id, isWalkIn\)/);
    expect(clean).toContain('String(isWalkIn)');   // or the answer goes stale on toggle
  });

  it('tells staff the booking will read a different time', () => {
    // They are looking at 13:20 on screen and the reservation will say 13:30.
    expect(block).toContain('slotCapacity.snapped_from');
    expect(block).toContain('reservations.walkInSnapped');
  });

  it('still names the overflow when the sitting goes over', () => {
    expect(block).toContain('reservations.walkInSnappedOver');
    expect(block).toContain('slotCapacity.over_by');
  });

  it('says it before claiming the save will fail', () => {
    // For a walk-in it will not fail — it is moved onto a sitting.
    expect(block.indexOf('slotCapacity.snapped_from'))
      .toBeLessThan(block.indexOf('slotCapacity.bookable === false'));
  });
});
