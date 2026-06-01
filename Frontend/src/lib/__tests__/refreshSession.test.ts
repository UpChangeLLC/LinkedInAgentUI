import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  refreshSignupSession,
  saveSignupSession,
  getStoredSignupSession,
} from '../signup';

const okResponse = (body: Record<string, unknown>) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

const errResponse = (status: number, body: Record<string, unknown>) => ({
  ok: false,
  status,
  json: async () => body,
});

describe('refreshSignupSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null and makes no request when there is no stored session', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshSignupSession();

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-fetches the session by stored token and reflects a newly-active subscription', async () => {
    // Browser is holding a stale "trial" session captured before an upgrade.
    saveSignupSession({
      status: 'ok',
      access_token: 'tok-123',
      email: 'user@example.com',
      subscription_status: 'trial',
      subscription_active: false,
    });
    expect(getStoredSignupSession()?.subscriptionActive).toBe(false);

    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        status: 'ok',
        access_token: 'tok-123',
        email: 'user@example.com',
        subscription_status: 'active',
        subscription_active: true,
        subscription_expires_at: '2027-05-30T00:00:00Z',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshSignupSession();

    // Hit the session endpoint with the stored token.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/signup/session');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ access_token: 'tok-123' });

    // Returns and persists the fresh, now-active session.
    expect(result?.subscriptionActive).toBe(true);
    expect(result?.subscriptionStatus).toBe('active');
    expect(getStoredSignupSession()?.subscriptionActive).toBe(true);
  });

  it('returns null and leaves the stored session untouched when refresh fails', async () => {
    saveSignupSession({
      status: 'ok',
      access_token: 'tok-123',
      email: 'user@example.com',
      subscription_status: 'active',
      subscription_active: true,
    });

    const fetchMock = vi.fn().mockResolvedValue(errResponse(404, { status: 'error', detail: 'Signup not found.' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshSignupSession();

    expect(result).toBeNull();
    // Existing good session is preserved (no clobbering on a transient failure).
    expect(getStoredSignupSession()?.subscriptionActive).toBe(true);
  });
});
