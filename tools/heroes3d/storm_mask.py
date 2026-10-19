# Stormcore Common mask for 3D: centred core ball + 4 forked-bolt lobes, evenly spread, none within 30 deg of straight up
# or inside the 70 deg straight-down sector (stormcore.md lobe rule). Outputs mask (white body) + glow ridge map.
import math, sys
from PIL import Image, ImageDraw, ImageFilter
S = 1200; R = 230; cx, cy = S // 2, S // 2
im = Image.new('L', (S, S), 0); d = ImageDraw.Draw(im)
ridge = Image.new('L', (S, S), 0); rd = ImageDraw.Draw(ridge)
d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=255)
def bolt(ang_deg, L, W, kinks, fork, seed):
    a = math.radians(ang_deg); ux, uy = math.sin(a), -math.cos(a); px_, py_ = -uy, ux
    pts = []; x, y = cx + ux * R * 0.55, cy + uy * R * 0.55; pts.append((x, y))
    n = len(kinks)
    for i, k in enumerate(kinks):
        t = (i + 1) / n; x = cx + ux * (R * 0.55 + L * t) + px_ * k * W; y = cy + uy * (R * 0.55 + L * t) + py_ * k * W; pts.append((x, y))
    for i in range(len(pts) - 1):
        w = W * (1 - 0.75 * i / len(pts)) + 6
        d.line([pts[i], pts[i + 1]], fill=255, width=int(w)); q = w * 0.3; d.ellipse((pts[i+1][0]-q, pts[i+1][1]-q, pts[i+1][0]+q, pts[i+1][1]+q), fill=255)
        rd.line([pts[i], pts[i + 1]], fill=255, width=max(4, int(w * 0.35)))
    # fork: two uneven tips off the last kink
    bx, by = pts[-2]
    for fa, fl in fork:
        a2 = a + math.radians(fa); tx, ty = bx + math.sin(a2) * fl, by - math.cos(a2) * fl
        d.line([(bx, by), (tx, ty)], fill=255, width=int(W * 0.28)); rd.line([(bx, by), (tx, ty)], fill=255, width=5)
# angles measured clockwise from straight up; down sector 145..215 excluded, up sector -30..30 excluded
bolt(58, 330, 105, [0.55, -0.65, 0.6, -0.3], [(-30, 120), (36, 75)], 1)     # dominant, upper right
bolt(126, 200, 80, [-0.6, 0.6, -0.2], [(32, 80), (-26, 55)], 2)              # short, lower right
bolt(262, 290, 95, [0.6, -0.55, 0.5, -0.15], [(28, 100), (-34, 65)], 3)      # long, left (no mirror of the first)
rd.ellipse((cx - R * 0.5, cy - R * 0.5, cx + R * 0.5, cy + R * 0.5), fill=255)
im = im.filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v > 127 else 0)
im.save(sys.argv[1]); ridge.filter(ImageFilter.GaussianBlur(18)).save(sys.argv[2])
