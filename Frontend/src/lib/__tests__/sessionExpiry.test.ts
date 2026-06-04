import { describe, it, expect } from 'vitest';
import { isAuthRestoreError } from '../signup';

describe('isAuthRestoreError', () => {
  it('treats expired/invalid token errors as auth errors (prompt re-login)', () => {
    for (const m of ['Signup not found.', 'HTTP 401', 'HTTP 404', 'HTTP 403', 'Session invalid', 'token expired', 'Unauthorized']) {
      expect(isAuthRestoreError(m)).toBe(true);
    }
  });

  it('treats transient network/server errors as non-auth (do not force login)', () => {
    for (const m of ['Failed to fetch', 'HTTP 500', 'HTTP 503', 'Database is not configured.', 'Could not restore session.', '']) {
      expect(isAuthRestoreError(m)).toBe(false);
    }
  });
});
