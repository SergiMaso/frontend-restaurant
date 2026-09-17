import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
});
