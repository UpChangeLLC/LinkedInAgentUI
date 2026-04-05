/**
 * Canvas-based LinkedIn share badge generator.
 * Renders a 1200x628px branded badge optimized for LinkedIn feeds.
 */

interface BadgeParams {
  score: number;
  riskBand: string;
  name: string;
  title: string;
}

function drawScoreArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  score: number,
) {
  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 12;
  ctx.stroke();

  // Score arc
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.PI * 2 * score) / 100;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.strokeStyle = '#14B8A6';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export async function generateShareBadge(params: BadgeParams): Promise<Blob> {
  const { score, riskBand, name, title } = params;

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 628;
  const ctx = canvas.getContext('2d')!;

  // ── Background ──────────────────────────────────────────────────────
  ctx.fillStyle = '#0B1120';
  ctx.fillRect(0, 0, 1200, 628);

  // Subtle gradient overlay
  const grad = ctx.createRadialGradient(600, 250, 50, 600, 250, 500);
  grad.addColorStop(0, 'rgba(20, 184, 166, 0.08)');
  grad.addColorStop(1, 'rgba(11, 17, 32, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 628);

  // ── Score circle (centered) ─────────────────────────────────────────
  const cx = 600;
  const cy = 230;
  const radius = 100;

  drawScoreArc(ctx, cx, cy, radius, score);

  // Score number
  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(score), cx, cy - 8);

  // "/100" label
  ctx.fillStyle = '#64748B';
  ctx.font = '20px system-ui, -apple-system, sans-serif';
  ctx.fillText('/100', cx, cy + 36);

  // ── Risk band pill ──────────────────────────────────────────────────
  const bandText = riskBand || 'Assessed';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  const bandWidth = ctx.measureText(bandText).width + 40;
  const bandX = cx - bandWidth / 2;
  const bandY = cy + 70;

  // Pill background
  ctx.fillStyle = 'rgba(20, 184, 166, 0.15)';
  ctx.beginPath();
  ctx.roundRect(bandX, bandY, bandWidth, 36, 18);
  ctx.fill();

  // Pill border
  ctx.strokeStyle = 'rgba(20, 184, 166, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bandX, bandY, bandWidth, 36, 18);
  ctx.stroke();

  // Pill text
  ctx.fillStyle = '#14B8A6';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(bandText, cx, bandY + 20);

  // ── Brand header ────────────────────────────────────────────────────
  // Logo placeholder (teal square with "UC" text)
  ctx.fillStyle = '#14B8A6';
  ctx.beginPath();
  ctx.roundRect(40, 36, 40, 40, 8);
  ctx.fill();
  ctx.fillStyle = '#0B1120';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('UC', 60, 62);

  // Brand text
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AI Resilience Score\u2122', 92, 62);

  // "Official Report" badge
  ctx.strokeStyle = 'rgba(20, 184, 166, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(1040, 38, 130, 32, 4);
  ctx.stroke();
  ctx.fillStyle = '#14B8A6';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText('OFFICIAL REPORT', 1105, 58);

  // ── User info (bottom) ──────────────────────────────────────────────
  // Divider
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 440);
  ctx.lineTo(1000, 440);
  ctx.stroke();

  // Name
  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, cx, 485);

  // Title
  ctx.fillStyle = '#64748B';
  ctx.font = '20px system-ui, -apple-system, sans-serif';
  ctx.fillText(title, cx, 518);

  // ── CTA (bottom) ────────────────────────────────────────────────────
  ctx.fillStyle = '#14B8A6';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Check your AI Resilience Score \u2192 upchange.ai', cx, 580);

  // ── Export ──────────────────────────────────────────────────────────
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });
}
