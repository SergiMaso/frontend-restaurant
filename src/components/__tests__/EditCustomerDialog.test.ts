import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Editing a customer whose stored identifier is not a real phone.
 *
 * Structural, like the other tests here. The phone field starts empty for anything not
 * starting with "+", and it was required unless the customer had a BSUID — so a
 * customer stored under an old id or the walk-in placeholder could not be saved just
 * to fix their name. Found in review, 2026-09-23.
 */
const src = readFileSync(resolve(__dirname, '../EditCustomerDialog.tsx'), 'utf8');

describe('EditCustomerDialog — phone requirement', () => {
  it('requires a phone only from a customer who already has a real one', () => {
    expect(src).toMatch(/const noRealPhone = !!customer && !customer\.phone\?\.startsWith\("\+"\)/);
    expect(src).toMatch(/if \(!noRealPhone && !phone\.trim\(\)\)/);
    expect(src).toContain('required={!noRealPhone}');
  });

  it('shows the stored identifier instead of hiding it', () => {
    expect(src).toContain('customers.storedId');
    for (const lang of ['ca', 'es', 'en', 'it']) {
      const d = JSON.parse(readFileSync(
        resolve(__dirname, `../../i18n/locales/${lang}/dashboard.json`), 'utf8'));
      expect(d.customers.storedId, lang).toBeTruthy();
    }
  });
});
