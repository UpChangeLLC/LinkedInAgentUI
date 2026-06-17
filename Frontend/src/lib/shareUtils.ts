/** Shared LinkedIn share URL builder + clipboard copy helper. */

const SITE_URL = 'https://airesiliencescore.com';

export function buildLinkedInShareUrl(score: number, riskBand: string, extra?: string): string {
  let text = `I just scored ${score}/100 on the AI Resilience Score\u2122 (${riskBand}).`;
  if (extra) {
    text += `\n\n${extra}`;
  }
  text += `\n\nHow AI-ready are you? \u{1F449} ${SITE_URL}\n\n#AILeadership #FutureOfWork`;
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

export async function copyShareLink(score: number): Promise<void> {
  const text = `I just got my AI Resilience Score: ${score}/100. Check your executive AI readiness here: ${SITE_URL}`;
  await navigator.clipboard.writeText(text);
}
