export interface NormalizeResult {
  url: string;
  corrections: string[];
}

const DOMAIN_TYPOS: Record<string, string> = {
  'linkdin.com': 'linkedin.com',
  'linkedn.com': 'linkedin.com',
  'linkein.com': 'linkedin.com',
  'linkeind.com': 'linkedin.com',
  'linkedin.con': 'linkedin.com',
  'linked.in': 'linkedin.com',
  'linkin.com': 'linkedin.com',
  'lnkedin.com': 'linkedin.com',
};

export function normalizeLinkedInUrl(raw: string): NormalizeResult {
  const corrections: string[] = [];
  let url = raw.trim();

  if (!url) return { url, corrections };

  // Strip trailing slashes and whitespace
  url = url.replace(/\/+$/, '');

  // Prepend https:// if missing
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url;
    corrections.push('Added https://');
  }

  // Common domain typos
  for (const [typo, fix] of Object.entries(DOMAIN_TYPOS)) {
    if (url.toLowerCase().includes(typo)) {
      url = url.replace(new RegExp(typo.replace('.', '\\.'), 'i'), fix);
      corrections.push('Fixed domain spelling');
      break;
    }
  }

  // Case normalization for the domain
  url = url.replace(/linkedin\.com/gi, 'linkedin.com');
  url = url.replace(/www\.linkedin/gi, 'www.linkedin');

  // Strip query parameters
  const qIdx = url.indexOf('?');
  if (qIdx > -1) {
    url = url.substring(0, qIdx);
    corrections.push('Removed tracking parameters');
  }

  // Strip hash fragments
  const hIdx = url.indexOf('#');
  if (hIdx > -1) {
    url = url.substring(0, hIdx);
  }

  // Add /in/ if missing (linkedin.com/username → linkedin.com/in/username)
  const pathMatch = url.match(/linkedin\.com\/([\w][\w-]*)\/?$/);
  if (pathMatch && !['in', 'pub', 'company', 'school', 'jobs', 'feed'].includes(pathMatch[1])) {
    url = url.replace(`/${pathMatch[1]}`, `/in/${pathMatch[1]}`);
    corrections.push('Added /in/ path');
  }

  // Normalize www
  url = url.replace('://www.linkedin.com', '://linkedin.com');

  // Clean trailing slash
  url = url.replace(/\/+$/, '');

  return { url, corrections };
}
