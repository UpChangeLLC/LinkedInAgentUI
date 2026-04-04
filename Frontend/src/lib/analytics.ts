/** Fire-and-forget analytics event tracking. Never blocks UX. */

const env = (import.meta as any).env || {};
const baseUrl = ((env.VITE_MCP_BASE_URL as string) ?? '').replace(/\/+$/, '');

export function trackEvent(eventType: string, metadata: Record<string, unknown> = {}): void {
  try {
    fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, metadata }),
    }).catch(() => {});
  } catch {
    // Never throw — analytics must not break UX
  }
}
