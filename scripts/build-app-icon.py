#!/usr/bin/env python3
"""Build app icons from a combat gel plate with magenta chroma-key (no studio pink)."""
from __future__ import annotations

import math
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
GEL = ROOT / "assets/battle/gels/combat/fire_a.jpg"
OUT_DIR = ROOT / "build/icons"
ELECTRON_ICONS = ROOT / "electron/icons"
SIZE = 1024


def is_studio_magenta(r: int, g: int, b: int) -> float:
    """Return key strength 0..1 for hot-pink / magenta studio backdrop."""
    mx = max(r, g, b)
    mn = min(r, g, b)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    sat = (mx - mn) / 255.0 if mx else 0.0
    # Pure studio #FF00AA-ish
    if r > 160 and b > 90 and g < 120 and (r - g) > 50 and (b - g) > 20:
        return 1.0
    if r > 180 and b > 110 and g < 140 and sat > 0.28 and (r + b) > (g * 2.1):
        return 1.0
    # Hot pink fringe / AA
    if r > 150 and b > 100 and g < 150 and (r - g) > 35 and (b - g) > 10 and sat > 0.22:
        return 0.92
    # Dirty white-pink fringe
    if lum > 170 and r > 170 and b > 140 and g > 120 and (r - g) > 18 and (b - g) > 8:
        return 0.85
    # Soft pink halo
    if r > 140 and b > 100 and g < 160 and (r - g) > 25 and sat > 0.18 and lum < 230:
        return 0.7
    return 0.0


def chroma_key_gel(src: Image.Image) -> Image.Image:
    """Magenta studio → alpha; despill residual pink on edges."""
    im = src.convert("RGBA")
    w, h = im.size
    px = im.load()
    alpha = [[1.0] * w for _ in range(h)]

    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            k = is_studio_magenta(r, g, b)
            if k >= 0.95:
                alpha[y][x] = 0.0
            elif k >= 0.7:
                alpha[y][x] = max(0.0, 1.0 - k)
            else:
                alpha[y][x] = 1.0

    # Flood-fill from borders: only key connected studio regions
    from collections import deque

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    studio = [[False] * w for _ in range(h)]
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        r, g, b, _a = px[x, y]
        k = is_studio_magenta(r, g, b)
        # Also treat near-solid key with low green as border seed
        if k < 0.35 and not (r > 170 and b > 100 and g < 130 and (r - g) > 40):
            continue
        studio[y][x] = True
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if studio[y][x]:
                k = is_studio_magenta(r, g, b)
                a = 0 if k >= 0.55 else int(255 * max(0.0, 1.0 - k * 1.4))
            else:
                a = 255
                # Light despill on non-studio edge-ish pink
                if r > g + 20 and b > g + 10 and r > 140:
                    pull = min(40, (r - g) // 2)
                    r = max(0, r - pull)
                    b = max(0, b - pull // 2)
                    g = min(255, g + pull // 3)
            if a < 12:
                op[x, y] = (0, 0, 0, 0)
            else:
                op[x, y] = (r, g, b, a)

    # Erode 1px of residual fringe
    erode = out.filter(ImageFilter.MinFilter(3))
    # Keep interior body, only shrink fringe: blend with original alpha
    ea = erode.split()[3]
    oa = out.split()[3]
    # Take min alpha near edges only
    import numpy as np

    a0 = np.array(oa, dtype=np.uint8)
    a1 = np.array(ea, dtype=np.uint8)
    # Only erode where original was semi or neighbor keyed
    mixed = np.minimum(a0, np.where(a0 < 250, a1, a0))
    out.putalpha(Image.fromarray(mixed, mode="L"))
    return out


def tight_crop(im: Image.Image, pad: float = 0.04) -> Image.Image:
    a = im.split()[3]
    bbox = a.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0
    px = int(max(bw, bh) * pad)
    x0 = max(0, x0 - px)
    y0 = max(0, y0 - px)
    x1 = min(im.width, x1 + px)
    y1 = min(im.height, y1 + px)
    return im.crop((x0, y0, x1, y1))


def make_icon(gel_rgba: Image.Image, size: int = SIZE) -> Image.Image:
    """Dark forest plate + gold ring + chroma gel."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # Rounded dark plate (macOS-friendly, but also works as square fill)
    margin = int(size * 0.02)
    radius = int(size * 0.18)
    plate = [
        margin,
        margin,
        size - margin - 1,
        size - margin - 1,
    ]
    # Forest gradient-ish base
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(2 + t * 6)
        g = int(18 + t * 14)
        b = int(10 + t * 8)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Soft vignette circle
    vignette = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    cx = cy = size // 2
    for i in range(8):
        rad = int(size * (0.48 - i * 0.02))
        alpha = 18 + i * 6
        vd.ellipse(
            [cx - rad, cy - rad, cx + rad, cy + rad],
            fill=(0, 8, 4, alpha),
        )
    canvas = Image.alpha_composite(canvas, vignette)
    draw = ImageDraw.Draw(canvas)

    # Gold ring
    ring_outer = int(size * 0.42)
    ring_inner = int(size * 0.36)
    gold = (201, 164, 74, 255)
    gold_dark = (140, 100, 36, 255)
    gold_hi = (240, 210, 130, 255)
    draw.ellipse(
        [cx - ring_outer, cy - ring_outer, cx + ring_outer, cy + ring_outer],
        outline=gold,
        width=max(4, size // 48),
    )
    draw.ellipse(
        [cx - ring_outer + 2, cy - ring_outer + 2, cx + ring_outer - 2, cy + ring_outer - 2],
        outline=gold_hi,
        width=max(2, size // 96),
    )
    draw.ellipse(
        [cx - ring_inner, cy - ring_inner, cx + ring_inner, cy + ring_inner],
        outline=gold_dark,
        width=max(2, size // 80),
    )

    # Place gel inside ring
    gel = tight_crop(gel_rgba)
    target = int(size * 0.62)
    gel.thumbnail((target, target), Image.Resampling.LANCZOS)
    gx = cx - gel.width // 2
    gy = cy - gel.height // 2 + int(size * 0.02)
    canvas.paste(gel, (gx, gy), gel)

    # Soft outer shadow ring already dark; ensure fully opaque for .ico friendliness
    # Keep corners dark solid (no checker) — electron icons work best opaque
    base = Image.new("RGBA", (size, size), (2, 18, 12, 255))
    base = Image.alpha_composite(base, canvas)
    return base.convert("RGBA")


def write_png_sizes(icon: Image.Image) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    icon.save(OUT_DIR / "icon.png", "PNG")
    icon.save(OUT_DIR / "icon-1024.png", "PNG")
    icon.save(OUT_DIR / "icon_1024.png", "PNG")
    for s in (16, 32, 48, 64, 128, 256, 512):
        icon.resize((s, s), Image.Resampling.LANCZOS).save(OUT_DIR / f"icon_{s}.png", "PNG")


def write_iconset(icon: Image.Image) -> Path:
    iconset = OUT_DIR / "AppIcon.iconset"
    if iconset.exists():
        for f in iconset.iterdir():
            f.unlink()
    else:
        iconset.mkdir(parents=True, exist_ok=True)
    mapping = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }
    for name, s in mapping.items():
        icon.resize((s, s), Image.Resampling.LANCZOS).save(iconset / name, "PNG")
    return iconset


def write_icns(iconset: Path) -> None:
    icns = OUT_DIR / "icon.icns"
    subprocess.check_call(["iconutil", "-c", "icns", str(iconset), "-o", str(icns)])


def write_ico(icon: Image.Image) -> None:
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    imgs = [icon.resize(s, Image.Resampling.LANCZOS) for s in sizes]
    imgs[0].save(OUT_DIR / "icon.ico", format="ICO", sizes=sizes, append_images=imgs[1:])


def sync_electron() -> None:
    ELECTRON_ICONS.mkdir(parents=True, exist_ok=True)
    for name in ("icon.png", "icon.icns", "icon.ico"):
        src = OUT_DIR / name
        if src.exists():
            data = src.read_bytes()
            (ELECTRON_ICONS / name).write_bytes(data)


def count_hotpink(im: Image.Image) -> int:
    px = im.load()
    w, h = im.size
    n = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a > 20 and r > 180 and b > 120 and g < 120 and (r - g) > 60:
                n += 1
    return n


def main() -> int:
    if not GEL.exists():
        print("Missing gel plate:", GEL, file=sys.stderr)
        return 1
    print("Keying", GEL)
    gel = chroma_key_gel(Image.open(GEL))
    gel_hp = count_hotpink(gel)
    print(f"  gel hotpink-ish (step2): {gel_hp}")
    icon = make_icon(gel, SIZE)
    hp = count_hotpink(icon)
    print(f"  icon hotpink-ish (step2): {hp}")
    if hp > 800:
        print("WARNING: residual magenta still high", file=sys.stderr)
    write_png_sizes(icon)
    iconset = write_iconset(icon)
    write_icns(iconset)
    write_ico(icon)
    sync_electron()
    print("Wrote", OUT_DIR / "icon.png")
    print("Wrote", OUT_DIR / "icon.icns")
    print("Wrote", OUT_DIR / "icon.ico")
    print("Synced electron/icons")
    return 0 if hp <= 800 else 2


if __name__ == "__main__":
    sys.exit(main())
