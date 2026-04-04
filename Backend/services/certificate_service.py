"""Certificate image generation using Pillow."""

from __future__ import annotations

import io
import math
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont


# Certificate dimensions (LinkedIn share image)
WIDTH = 1200
HEIGHT = 630

# Colors
_BLUE_DARK = (0, 90, 140)
_BLUE_MID = (0, 119, 181)  # LinkedIn blue #0077B5
_BLUE_LIGHT = (0, 160, 220)
_WHITE = (255, 255, 255)
_GOLD = (255, 200, 50)
_LIGHT_GRAY = (200, 210, 220)


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Get a font, falling back to default if system fonts are unavailable."""
    # Try common system font paths
    font_names = (
        ["Arial Bold", "Helvetica-Bold", "DejaVuSans-Bold"]
        if bold
        else ["Arial", "Helvetica", "DejaVuSans"]
    )
    for name in font_names:
        for ext in (".ttf", ".ttc"):
            for prefix in (
                "/System/Library/Fonts/",
                "/usr/share/fonts/truetype/dejavu/",
                "/usr/share/fonts/",
                "C:/Windows/Fonts/",
            ):
                try:
                    return ImageFont.truetype(f"{prefix}{name}{ext}", size)
                except (OSError, IOError):
                    continue
    # Fallback to default
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except (OSError, IOError):
        return ImageFont.load_default()


def _estimate_percentile(score: int) -> int:
    """Estimate percentile from score (0-100 scale).

    Simple sigmoid mapping: score 50 -> ~50th percentile,
    score 80 -> ~90th percentile, score 30 -> ~15th percentile.
    """
    # Logistic curve centered at 50, stretched
    x = (score - 50) / 15
    percentile = 100 / (1 + math.exp(-x))
    return max(1, min(99, int(percentile)))


def _draw_gradient_background(draw: ImageDraw.ImageDraw) -> None:
    """Draw a LinkedIn blue gradient background."""
    for y in range(HEIGHT):
        ratio = y / HEIGHT
        r = int(_BLUE_DARK[0] * (1 - ratio) + _BLUE_MID[0] * ratio)
        g = int(_BLUE_DARK[1] * (1 - ratio) + _BLUE_MID[1] * ratio)
        b = int(_BLUE_DARK[2] * (1 - ratio) + _BLUE_MID[2] * ratio)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))


def _draw_border(draw: ImageDraw.ImageDraw) -> None:
    """Draw a decorative border."""
    margin = 20
    draw.rectangle(
        [margin, margin, WIDTH - margin, HEIGHT - margin],
        outline=_GOLD,
        width=2,
    )
    inner = margin + 6
    draw.rectangle(
        [inner, inner, WIDTH - inner, HEIGHT - inner],
        outline=(*_WHITE, 80),
        width=1,
    )


def _centered_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill=_WHITE,
) -> None:
    """Draw centered text at the given y coordinate."""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    x = (WIDTH - text_width) // 2
    draw.text((x, y), text, font=font, fill=fill)


def generate_certificate(result: dict) -> bytes:
    """Generate a branded PNG certificate image.

    Args:
        result: The pipeline result dict.

    Returns:
        PNG image content as bytes.
    """
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)

    # Background gradient
    _draw_gradient_background(draw)

    # Decorative border
    _draw_border(draw)

    # Fonts
    font_title = _get_font(36, bold=True)
    font_score = _get_font(72, bold=True)
    font_name = _get_font(28, bold=True)
    font_detail = _get_font(18)
    font_small = _get_font(14)
    font_brand = _get_font(12)

    # Extract data
    name = result.get("name", "Assessment Subject")
    title = result.get("title", result.get("benchmark_role", ""))
    score = int(result.get("profile_score", 0))
    industry = result.get("industry", "Technology")
    date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    percentile = _estimate_percentile(score)

    # --- Title ---
    _centered_text(draw, 50, "AI RESILIENCE CERTIFIED", font_title, _GOLD)

    # Decorative line under title
    line_y = 98
    draw.line([(350, line_y), (850, line_y)], fill=_GOLD, width=2)

    # --- Score ---
    _centered_text(draw, 120, str(score), font_score, _WHITE)

    # Score label
    _centered_text(draw, 205, "AI Resilience Score", font_detail, _LIGHT_GRAY)

    # --- Name and role ---
    _centered_text(draw, 260, name, font_name, _WHITE)
    if title:
        _centered_text(draw, 298, title, font_detail, _LIGHT_GRAY)

    # --- Percentile ---
    percentile_text = f"Top {100 - percentile}% of {industry} Leaders"
    _centered_text(draw, 350, percentile_text, font_detail, _GOLD)

    # --- Date ---
    _centered_text(draw, 400, f"Assessed on {date_str}", font_small, _LIGHT_GRAY)

    # --- Decorative elements ---
    # Small diamond separators
    cx = WIDTH // 2
    for dx in (-80, 0, 80):
        diamond_x = cx + dx
        diamond_y = 440
        draw.polygon(
            [
                (diamond_x, diamond_y - 4),
                (diamond_x + 4, diamond_y),
                (diamond_x, diamond_y + 4),
                (diamond_x - 4, diamond_y),
            ],
            fill=_GOLD,
        )

    # --- Footer branding ---
    _centered_text(
        draw,
        470,
        "This certificate validates AI readiness assessment completion",
        font_small,
        (*_WHITE, 180),
    )
    _centered_text(
        draw,
        500,
        "Verified by AI Resilience Score Platform",
        font_small,
        (*_WHITE, 180),
    )

    # Bottom brand bar
    draw.rectangle([0, HEIGHT - 40, WIDTH, HEIGHT], fill=_BLUE_DARK)
    _centered_text(
        draw, HEIGHT - 32, "airesiliencescore.com", font_brand, _LIGHT_GRAY
    )

    # Export as PNG
    buf = io.BytesIO()
    img.save(buf, format="PNG", quality=95)
    return buf.getvalue()
