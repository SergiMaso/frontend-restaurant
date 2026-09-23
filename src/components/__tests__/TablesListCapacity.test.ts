import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { capacityReplyIsStale } from '../../lib/capacity';
import { resolve } from 'node:path';

// Structural assertions over the source, same approach as ReservationDialog.test.ts:
// no jsdom in this project, so these cover the wiring rather than the rendering. The
// wiring is what the re-seating flow can get wrong in a way nobody notices until a
// restaurant applies a layout it never saw.
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const source = stripComments(
  readFileSync(resolve(__dirname, '../TablesList.tsx'), 'utf8'),
);
const api = stripComments(
  readFileSync(resolve(__dirname, '../../services/api.ts'), 'utf8'),
);

const locales = ['ca', 'es', 'en', 'it'] as const;

/**
 * The text of one useMutation declaration.
 *
 * Sliced by position rather than matched with a lazy `\}\)`: that stopped at the first
 * `})` in the source, which is the closing brace of the argument's inline type followed
 * by the parameter list's paren — so the "block" ended before mutationFn's body and
 * every assertion about its contents failed on a declaration that was perfectly fine.
 */
const mutationBlock = (name: string) => {
  const start = source.indexOf(`const ${name} = useMutation({`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const end = source.indexOf('\n  });', start);
  expect(end, `${name} has no closing brace`).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe('TablesList — capacity re-seating', () => {
  it('checks before it writes', () => {
    // The primary button must reach the rolled-back run first. Wiring it straight to
    // the apply would delete and rebuild the table plan on the first click, which is
    // the behaviour the preview exists to replace.
    expect(mutationBlock('previewMutation')).toContain('dryRun: true');
    expect(mutationBlock('applyMutation')).not.toContain('dryRun: true');
  });

  it('both paths ask for re-seating, so the check matches the apply', () => {
    // A preview run without reseat would be answered by the refusal branch instead of
    // the re-seating one: it would report "there are future bookings" for a change that
    // would in fact succeed.
    for (const name of ['previewMutation', 'applyMutation']) {
      expect(mutationBlock(name), `${name} must pass reseat`).toContain('reseat: true');
    }
  });

  it('editing a number drops the preview', () => {
    // Otherwise the Apply button stays live next to figures computed for seat counts
    // that are no longer on screen, and applies a layout the user never saw.
    expect(source).toMatch(/const editSeats[\s\S]{0,200}?setPreview\(null\)/);
    expect(source).toContain('editSeats(setInsideSeats)');
    expect(source).toContain('editSeats(setTerraceSeats)');
  });

  it('applies straight away when there is nothing to move', () => {
    // A restaurant with no future bookings must not be made to confirm a re-seating of
    // zero bookings.
    expect(mutationBlock('previewMutation'))
      .toMatch(/reseated === 0[\s\S]{0,160}?applyMutation\.mutate/);
  });

  it('keeps the bookings that do not fit on screen', () => {
    // They are a list of people to phone. A toast scrolls away while you read it.
    expect(source).toMatch(/would_not_fit[\s\S]{0,200}?setHomeless/);
    expect(source).toContain('homeless.map');
    // And no toast for that branch — the handler must return before reaching one.
    const branch = source.match(/if \(error\.code === "would_not_fit"\)[\s\S]{0,200}?\}/)?.[0];
    expect(branch).toBeDefined();
    expect(branch).not.toContain('toast.');
  });

  it('never lets the button fire while either call is in flight', () => {
    // Two overlapping generations would each delete the other's tables; the backend's
    // exclusive lock serialises them, but the second one still rebuilds the plan.
    expect(source).toMatch(
      /capacityPending\s*=\s*previewMutation\.isPending \|\| applyMutation\.isPending/,
    );
    expect(source).toContain('disabled={capacityPending}');
  });

  it('sends the flags the backend reads', () => {
    // app.py reads data.get('reseat') and data.get('dry_run'). camelCase in the body
    // would be silently false, and the dry run would write.
    const fn = api.match(/export async function generateCapacityTables[\s\S]{0,900}?\n\}/)?.[0];
    expect(fn).toBeDefined();
    expect(fn).toContain('reseat: options.reseat');
    expect(fn).toContain('dry_run: options.dryRun');
  });

  it('carries the refusal detail through to the dialog', () => {
    const fn = api.match(/export async function generateCapacityTables[\s\S]{0,900}?\n\}/)?.[0];
    expect(fn).toMatch(/new CapacityTablesError\([\s\S]{0,200}?body\.homeless/);
  });

  it('has every new string in all four languages', () => {
    const keys = [
      'setCapacityApply', 'capacityGeneratedMoved', 'capacityWillMove',
      'capacityWillMoveHelp', 'capacityNoFit', 'capacityNoFitPeople',
    ];
    for (const locale of locales) {
      const dashboard = JSON.parse(
        readFileSync(resolve(__dirname, `../../i18n/locales/${locale}/dashboard.json`), 'utf8'),
      );
      for (const key of keys) {
        expect(dashboard.tables?.[key], `${locale} is missing tables.${key}`).toBeTruthy();
      }
    }
  });

  it('interpolates the counts the code actually passes', () => {
    // t("…", { count, moved }) against a string written with {{count}} only would drop
    // the second number silently.
    for (const locale of locales) {
      const dashboard = JSON.parse(
        readFileSync(resolve(__dirname, `../../i18n/locales/${locale}/dashboard.json`), 'utf8'),
      );
      expect(dashboard.tables.capacityGeneratedMoved).toContain('{{count}}');
      expect(dashboard.tables.capacityGeneratedMoved).toContain('{{moved}}');
      expect(dashboard.tables.capacityWillMove).toContain('{{count}}');
      expect(dashboard.tables.capacityNoFit).toContain('{{count}}');
      expect(dashboard.tables.capacityNoFitPeople).toContain('{{count}}');
    }
  });

  it('drops a reply describing numbers that are no longer on screen', () => {
    // The reproduced failure: ask to check ten, change the field to five while the
    // request is in flight, and the reply for ten comes back with nothing to re-seat —
    // which applies without asking. Ten seats get built while the dialog reads five.
    const checked = { inside: 10, terrace: 0 };

    expect(
      capacityReplyIsStale({ inside: 5, terrace: 0, open: true }, checked),
      'a reply for ten must not be acted on while the field reads five',
    ).toBe(true);

    expect(
      capacityReplyIsStale({ inside: 10, terrace: 4, open: true }, checked),
      'the terrace changed under it, so the reply is equally stale',
    ).toBe(true);

    // Closing the dialog abandons the change. The apply would otherwise still fire,
    // with nothing on screen to say that it had.
    expect(
      capacityReplyIsStale({ inside: 10, terrace: 0, open: false }, checked),
    ).toBe(true);

    // And the ordinary case still goes through, or the button would do nothing at all.
    expect(
      capacityReplyIsStale({ inside: 10, terrace: 0, open: true }, checked),
    ).toBe(false);
  });

  it('guards the auto-apply with that check', () => {
    // The rule is only worth anything if the branch that writes without asking is the
    // branch behind it.
    const block = mutationBlock('previewMutation');
    const guardAt = block.indexOf('capacityReplyIsStale');
    const applyAt = block.indexOf('applyMutation.mutate');
    expect(guardAt, 'previewMutation does not consult capacityReplyIsStale').toBeGreaterThan(-1);
    expect(applyAt).toBeGreaterThan(-1);
    expect(guardAt, 'the staleness check must come before the auto-apply').toBeLessThan(applyAt);
  });

  it('will not let the fields change mid-check either', () => {
    // Belt and braces with the guard above: the common way to produce a stale reply is
    // simply typing while it is in flight.
    const inside = source.slice(source.indexOf('id="inside-seats"'),
                               source.indexOf('id="inside-seats"') + 320);
    const terrace = source.slice(source.indexOf('id="terrace-seats"'),
                                source.indexOf('id="terrace-seats"') + 320);
    expect(inside).toContain('disabled={capacityPending}');
    expect(terrace).toContain('disabled={capacityPending}');
  });
});

describe('Capacity dialog — found in review (2026-09-23)', () => {
  const src = readFileSync(resolve(__dirname, '../TablesList.tsx'), 'utf8');

  it('cannot generate zero seats in total', () => {
    // Blank boxes were 0 + 0 and deleted every table; the bot then refused everything.
    expect(src).toMatch(/const noSeats = capacityValues\.inside \+ capacityValues\.terrace === 0/);
    expect(src).toMatch(/disabled=\{capacityPending \|\| noSeats\}/);
  });

  it('never replaces a real table plan without showing the preview', () => {
    expect(src).toMatch(/if \(result\.reseated === 0 && !hasRealPlan\)/);
    expect(src).toContain('capacityReplacesPlan');
  });

  it('refreshes the bookings after re-seating them', () => {
    const apply = src.slice(src.indexOf('const applyMutation'), src.indexOf('const previewMutation'));
    expect(apply).toContain('invalidateQueries({ queryKey: ["appointments"] })');
  });

  it('has the new strings in every language', () => {
    for (const lang of ['ca', 'es', 'en', 'it']) {
      const d = JSON.parse(readFileSync(
        resolve(__dirname, `../../i18n/locales/${lang}/dashboard.json`), 'utf8'));
      expect(d.tables.capacityNoSeats, lang).toBeTruthy();
      expect(d.tables.capacityReplacesPlan, lang).toContain('{{count}}');
    }
  });
});

import { isGeneratedCapacityPlan } from '../../lib/capacity';

describe('isGeneratedCapacityPlan', () => {
  const seat = (n: number, others: number[], area = 'inside') =>
    ({ table_number: n, capacity: 1, pairing: others, area });

  it('recognises exactly what generation creates', () => {
    expect(isGeneratedCapacityPlan([seat(1, [2, 3]), seat(2, [1, 3]), seat(3, [1, 2]),
                                    seat(4, [5], 'terrace'), seat(5, [4], 'terrace')])).toBe(true);
  });

  it('treats hand-made paired one-seat tables as a real plan', () => {
    // 1 and 2 paired, 3 on its own: all one-seaters, but not a generated plan.
    expect(isGeneratedCapacityPlan([seat(1, [2]), seat(2, [1]), seat(3, [])])).toBe(false);
  });

  it('treats any table bigger than one seat as a real plan', () => {
    expect(isGeneratedCapacityPlan([seat(1, [2]), { ...seat(2, [1]), capacity: 4 }])).toBe(false);
  });

  it('treats a pairing across areas as a real plan', () => {
    expect(isGeneratedCapacityPlan([seat(1, [2]), seat(2, [1], 'terrace')])).toBe(false);
  });
});
