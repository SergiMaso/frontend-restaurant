import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The WhatsApp reasoning picker in the Configuration tab.
 *
 * Structural, like the other tests here — no jsdom in this project. The backend
 * refuses anything outside none/low/medium/high with a 400, so what is protected
 * is that the dashboard offers exactly those and never a free-text box.
 * test_frontend_contracts.py checks the same list against the backend's.
 */
const source = readFileSync(
  resolve(__dirname, '../ClientConfigManager.tsx'), 'utf8',
);

describe('ClientConfigManager — reasoning effort', () => {
  it('offers exactly the values the backend accepts', () => {
    // The array literal itself, not "everything up to the next constant": that
    // depended on the order of declarations in the file (found in review).
    const block = source.match(/const REASONING_EFFORT_OPTIONS = \[([\s\S]*?)\];/)?.[1] ?? '';
    const offered = [...block.matchAll(/value: '([a-z_]+)'/g)].map(m => m[1]);
    expect(offered).toEqual(['none', 'low', 'medium', 'high']);
  });

  it('is chosen from a list, not typed', () => {
    expect(source).toMatch(/config\.key === 'ai_reasoning_effort' \? \([\s\S]{0,300}?<Select/);
  });

  it('does not leak into the voice provider list', () => {
    // That list is read by slicing between two constants; this one sitting
    // between them would make "low" look like a voice provider.
    const voice = source.slice(
      source.indexOf('const VOICE_PROVIDER_OPTIONS'),
      source.indexOf('const TIMEZONE_OPTIONS'),
    );
    expect(voice).not.toContain("'medium'");
  });

  it('leaves the timezone comment on the timezones', () => {
    // Inserting this list once pushed "IANA timezones we explicitly support"
    // above the wrong constant (found in review).
    expect(source).toMatch(/\/\/ IANA timezones[^\n]*\n\/\/[^\n]*\nconst TIMEZONE_OPTIONS/);
  });
});
