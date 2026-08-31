import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Structural, like the other tests here: no jsdom in this project. They cover the
// wiring — which is where the inherit/override distinction actually goes wrong.
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const editor = stripComments(
  readFileSync(resolve(__dirname, '../DayRulesEditor.tsx'), 'utf8'));
const weekday = stripComments(
  readFileSync(resolve(__dirname, '../WeeklyScheduleManager.tsx'), 'utf8'));
const dateDialog = stripComments(
  readFileSync(resolve(__dirname, '../OpeningHoursDialog.tsx'), 'utf8'));

describe('DayRulesEditor — inherit vs override', () => {
  it('sends null, never an empty object, when nothing is overridden', () => {
    // The backend treats null as "inherit" and {} as an override that supplies
    // nothing — which would make this level the recorded source of values it never
    // set, and break reset-to-inherit.
    // Counted, not just present: there is one of these per section (slots and
    // payment). Asserting presence passed while one of the two had been broken.
    const guards = editor.match(/Object\.keys\(next\)\.length \? next : null/g) || [];
    expect(
      guards.length,
      'both setSlots and setPayment must collapse an empty override to null',
    ).toBe(2);
  });

  it('offers a reset only once something IS overridden', () => {
    // The only way back to inheriting. Always showing it suggests a value exists here
    // when none does.
    expect(editor).toMatch(/overridden\s*&&\s*\(/);
    expect(editor).toContain('onReset');
  });

  it('seeds a new override from the inherited slots', () => {
    // Starting blank would read as "this day has no slots" and silently close it.
    expect(editor).toContain('startOverridingSlots');
    expect(editor).toMatch(/inheritedSlots\[service\]/);
  });

  it('treats an empty cap as no limit rather than zero', () => {
    // Zero would close the slot; the placeholder says which one an empty box means.
    expect(editor).toMatch(/raw\.trim\(\) === ""\s*\?\s*null/);
    expect(editor).toContain('dayRules.noLimit');
  });

  it('shows the inherited amount as a placeholder, not as a value', () => {
    // Otherwise "not set here" is indistinguishable from "set to that number", and
    // saving would turn an inherited value into an override.
    expect(editor).toMatch(/placeholder=\{inherited\?\.amount/);
  });

  it('hides deposits entirely when the restaurant cannot take one', () => {
    expect(editor).toMatch(/paymentsAvailable\s*&&\s*\(/);
  });

  it('hides slot caps unless fixed slots are in use', () => {
    expect(editor).toMatch(/showSlots\s*=\s*timeSlotsMode === "fixed"/);
  });
});

describe('Both dialogs use the same editor', () => {
  it('the weekday template renders it and sends null for cleared overrides', () => {
    expect(weekday).toContain('<DayRulesEditor');
    expect(weekday).toContain('slot_config: dayRules.slot_config ?? null');
    expect(weekday).toContain('payment_config: dayRules.payment_config ?? null');
  });

  it('the single date renders it and inherits from its WEEKDAY, not from global', () => {
    // This is the one real difference between the two dialogs: a date sits below the
    // weekday, so showing the global default as its placeholder would be wrong
    // whenever the weekday overrides it.
    expect(dateDialog).toContain('<DayRulesEditor');
    expect(dateDialog).toContain('getWeeklyDefaults');
    expect(dateDialog).toMatch(/weekday\?\.slot_config\?\.\[service\]/);
  });

  it('the date dialog converts JS Sunday-first to the API Monday-first index', () => {
    // getDay() is 0=Sunday, the API is 0=Monday. Getting this wrong shifts every
    // inherited value by a day, which looks plausible and is entirely wrong.
    expect(dateDialog).toContain('(date.getDay() + 6) % 7');
  });

  it('neither dialog offers rules for a closed day', () => {
    expect(weekday).toMatch(/status !== "closed" &&/);
    expect(dateDialog).toMatch(/status !== "closed" &&/);
  });
});
