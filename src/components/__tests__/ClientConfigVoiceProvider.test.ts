import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The voice provider picker in the Configuration tab.
 *
 * Structural, like the other tests here — no jsdom in this project. What is
 * being protected is the list of values, which has to stay in step with the
 * branches in the backend's voice_incoming: anything else reaches "Unknown
 * voice_provider", the call falls through to the error TwiML, and the only
 * person who finds out is whoever phones the restaurant.
 */
const source = readFileSync(
  resolve(__dirname, '../ClientConfigManager.tsx'), 'utf8',
);

describe('ClientConfigManager — voice provider', () => {
  it('offers the three providers the backend can connect to', () => {
    const block = source.slice(
      source.indexOf('const VOICE_PROVIDER_OPTIONS'),
      source.indexOf('const TIMEZONE_OPTIONS'),
    );
    for (const provider of ['openai', 'openai_live', 'google']) {
      expect(block, `${provider} missing from the picker`)
        .toContain(`value: '${provider}'`);
    }
  });

  it('is chosen from a list, not typed', () => {
    // Free text here is a silent break: a typo saves fine and only shows up as
    // a failed phone call.
    expect(source).toMatch(/config\.key === 'voice_provider' \? \([\s\S]{0,400}?<Select/);
  });

  it('still shows a stored value it does not recognise', () => {
    // Hiding it would make the field look unset and invite someone to overwrite
    // a provider this build simply has not heard of yet.
    const block = source.slice(
      source.indexOf("config.key === 'voice_provider'"),
      source.indexOf("config.key === 'timezone'"),
    );
    expect(block).toContain('(current)');
  });
});
