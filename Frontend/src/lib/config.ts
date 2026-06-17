/** Configurable external links — reads from VITE_ env vars with defaults. */

const env = (import.meta as any).env || {};

export const EXTERNAL_LINKS = {
  hyperaccelerator: (env.VITE_HYPERACCELERATOR_URL as string) || 'https://hyperaccelerator.com/',
} as const;
