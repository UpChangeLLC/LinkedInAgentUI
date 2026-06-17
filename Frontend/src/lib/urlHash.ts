/**
 * Compute SHA-256 hash of a LinkedIn URL, matching the backend's _hash_url() logic.
 * Backend: hashlib.sha256(url.strip().lower().rstrip("/").encode()).hexdigest()
 */
export async function hashLinkedInUrl(url: string): Promise<string> {
  const normalized = url.trim().toLowerCase().replace(/\/+$/, '');
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
