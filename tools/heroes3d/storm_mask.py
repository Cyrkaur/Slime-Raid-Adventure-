# Stormcore Common mask for 3D (v2, Oct 19 2026 Serif kick): centred core ball + 3 jagged forked-bolt lobes.
# Lobes are angular zigzag polygons (straight segments, sharp kinks) that taper to a POINT, each splitting into
# 2 uneven forks with sharp tips. Evenly spread, none within 30 deg of straight up, none in the 70 deg down sector
# (stormcore.md lobe rule), no mirror pair. Outputs mask (white body) + glow ridge map (core + bolt spines).
import math, sys
from PIL import Image, ImageDraw, ImageFilter
S = 1200; R = 215; cx, cy = S // 2, S // 2
im = Image.new('L', (S, S), 0); d = ImageDraw.Draw(im)
ridge = Image.new('L', (S, S), 0); rd = ImageDraw.Draw(ridge)
d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=255)
def U(a): return math.sin(a), -math.cos(a)
def strip(pts, widths, draw, fill=255):
    """filled polygon along a polyline; width tapers to 0 at the last point (sharp tip), mitred at kinks"""
    L, Rr = [], []
    for i, p in enumerate(pts):
        if i == 0: dx, dy = pts[1][0] - p[0], pts[1][1] - p[1]
        elif i == len(pts) - 1: dx, dy = p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]
        else:
            ax, ay = p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]; bx, by = pts[i + 1][0] - p[0], pts[i + 1][1] - p[1]
            la, lb = math.hypot(ax, ay), math.hypot(bx, by); dx, dy = ax / la + bx / lb, ay / la + by / lb
        l = math.hypot(dx, dy) or 1; nx, ny = -dy / l, dx / l; w = widths[i] / 2
        L.append((p[0] + nx * w, p[1] + ny * w)); Rr.append((p[0] - nx * w, p[1] - ny * w))
    draw.polygon(L + Rr[::-1], fill=fill)
def bolt(ang_deg, L, W, kinks, forks):
    a = math.radians(ang_deg); ux, uy = U(a); px_, py_ = -uy, ux
    pts = [(cx + ux * R * 0.5, cy + uy * R * 0.5)]
    n = len(kinks)
    for i, k in enumerate(kinks):
        t = (i + 1) / n; r = R * 0.85 + L * t
        pts.append((cx + ux * r + px_ * k * W, cy + uy * r + py_ * k * W))
    ws = [W * (1.0 - 0.8 * i / n) for i in range(n)] + [0.0]      # steps down in width, point at the tip
    strip(pts, ws, d); strip(pts, [w * 0.32 for w in ws], rd)
    bx, by = pts[-2]; base = ws[-2] * 0.95                       # forks split off the last kink
    for fa, fl, kink in forks:
        a2 = a + math.radians(fa); fx, fy = U(a2); qx, qy = -fy, fx
        mid = (bx + fx * fl * 0.55 + qx * kink * fl, by + fy * fl * 0.55 + qy * kink * fl)
        tip = (bx + fx * fl, by + fy * fl)
        strip([(bx, by), mid, tip], [base, base * 0.5, 0.0], d); strip([(bx, by), mid, tip], [base * 0.3, base * 0.15, 0.0], rd)
# angles clockwise from straight up
bolt(58, 330, 128, [0.5, -0.55, 0.5, -0.2], [(-32, 165, 0.12), (42, 105, -0.15)])     # dominant, upper right
bolt(128, 190, 104, [-0.55, 0.5, -0.2], [(36, 110, -0.12), (-30, 80, 0.15)])            # short, lower right
bolt(264, 290, 118, [0.55, -0.5, 0.45, -0.15], [(30, 145, 0.12), (-38, 95, -0.15)])    # long, left (no mirror of the first)
rd.ellipse((cx - R * 0.5, cy - R * 0.5, cx + R * 0.5, cy + R * 0.5), fill=255)
im = im.filter(ImageFilter.GaussianBlur(1.0)).point(lambda v: 255 if v > 127 else 0)
im.save(sys.argv[1]); ridge.filter(ImageFilter.GaussianBlur(14)).save(sys.argv[2])
