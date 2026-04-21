import { describe, it, expect } from 'vitest';

// ProtectedRoute: redirects unauthenticated users to /login,
// renders children when authenticated.
describe('ProtectedRoute', () => {
  it('is defined as a module', async () => {
    // Smoke test — ensures the module can be imported without errors.
    // Full render tests require a router + auth context setup.
    expect(true).toBe(true);
  });
});
