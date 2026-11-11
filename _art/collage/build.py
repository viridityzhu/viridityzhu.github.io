"""Draws the sticker art for the duck collage board.

Run from the repository root:  python3 _art/collage/build.py
Writes images/collage-*.svg. Standard library only.
"""
import math
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "images"
INK, PAPER, YELLOW, CORAL = "#151515", "#fffefa", "#fec900", "#ff7050"


def svg(name, box, body):
    text = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}">\n{body}\n</svg>\n'
    (OUT / f"collage-{name}.svg").write_text(text)


def bxsb():
    """A sunburst badge with bubble lettering, after the reference's WELCOME disc."""
    cx = cy = 120
    radius = 112
    rays = 18
    wedges = []
    for i in range(rays):
        a0 = math.radians(i * 360 / rays)
        a1 = math.radians((i + 0.5) * 360 / rays)
        x0, y0 = cx + radius * math.cos(a0), cy + radius * math.sin(a0)
        x1, y1 = cx + radius * math.cos(a1), cy + radius * math.sin(a1)
        wedges.append(f"M{cx} {cy}L{x0:.1f} {y0:.1f}A{radius} {radius} 0 0 1 {x1:.1f} {y1:.1f}Z")

    def b(x):
        return f"M{x} -52V-2M{x} -15a15 15 0 1 1 30 0a15 15 0 1 1 -30 0"

    # (skeleton, pivot x, tilt, lift): each letter bounces a little on its own.
    letters = [
        (b(0), 15, -8, 3),
        ("M54 -30L80 0M80 -30L54 0", 67, 7, -5),
        ("M127 -23C127 -33 103 -34 103 -22C103 -11 127 -19 127 -8C127 4 103 3 103 -7", 115, -6, 2),
        (b(150), 165, 8, -4),
    ]

    def layer(dx, dy, stroke, width):
        parts = []
        for path, pivot, tilt, lift in letters:
            parts.append(
                f'<path transform="translate({dx} {dy + lift}) rotate({tilt} {pivot} -20)" d="{path}" '
                f'stroke="{stroke}" stroke-width="{width}"/>')
        return "".join(parts)

    depth = "".join(layer(k, k, INK, 24) for k in (7, 6, 5, 4, 3, 2, 1))
    word = (
        '<g transform="translate(120 132) rotate(-10) scale(1.08) translate(-90 22)" fill="none" '
        'stroke-linecap="round" stroke-linejoin="round">'
        f"{depth}{layer(0, 0, INK, 24)}{layer(0, 0, YELLOW, 12.5)}</g>")
    svg("bxsb", "-12 -12 264 264", "\n".join([
        f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="{PAPER}"/>',
        f'<path d="{"".join(wedges)}" fill="{INK}"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="none" stroke="{INK}" stroke-width="5"/>',
        word,
    ]))


def relief():
    """Scan lines lifted by a duck-shaped height field: a 3D form read from 2D strokes."""
    def bump(x, y, cx, cy, rx, ry, height):
        d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        return height * math.sqrt(1 - d) if d < 1 else 0

    def height(x, y):
        return max(
            bump(x, y, 72, 104, 54, 33, 27),   # body
            bump(x, y, 100, 66, 28, 26, 25),   # head
            bump(x, y, 131, 72, 15, 8, 9),     # bill
        )

    rows = []
    for y0 in range(10, 157, 6):
        points = [f"{x} {y0 - height(x, y0):.1f}" for x in range(-4, 165, 2)]
        rows.append(f'<path d="M{"L".join(points)}L164 170L-4 170Z"/>')
    svg("relief", "0 0 160 160",
        f'<rect width="160" height="160" fill="{PAPER}"/>\n'
        f'<g fill="{PAPER}" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round">{"".join(rows)}</g>')


def mesh():
    """A wireframe icosahedron: the duck's facets, before any pigment."""
    phi = (1 + math.sqrt(5)) / 2
    verts = []
    for a in (-1, 1):
        for b in (-phi, phi):
            verts += [(0, a, b), (a, b, 0), (b, 0, a)]

    def turn(p, yaw=0.5, pitch=0.42):
        x, y, z = p
        x, z = x * math.cos(yaw) + z * math.sin(yaw), z * math.cos(yaw) - x * math.sin(yaw)
        y, z = y * math.cos(pitch) - z * math.sin(pitch), z * math.cos(pitch) + y * math.sin(pitch)
        return x, y, z

    verts = [turn(v) for v in verts]
    near = lambda i, j: abs(math.dist(verts[i], verts[j]) - 2) < 1e-6
    n = len(verts)
    edges = [(i, j) for i in range(n) for j in range(i + 1, n) if near(i, j)]
    faces = [(i, j, k) for i, j in edges for k in range(j + 1, n) if near(i, k) and near(j, k)]
    spot = lambda i: f"{50 + verts[i][0] * 23:.1f} {50 - verts[i][1] * 23:.1f}"

    front_edges = set()
    front = []
    for face in faces:
        if sum(verts[i][2] for i in face) > 0:
            front.append(f'<path d="M{"L".join(spot(i) for i in face)}Z"/>')
            front_edges |= {tuple(sorted(pair)) for pair in ((face[0], face[1]), (face[1], face[2]), (face[0], face[2]))}
    back = "".join(f"M{spot(i)}L{spot(j)}" for i, j in edges if (i, j) not in front_edges)
    svg("mesh", "0 0 100 100",
        f'<g stroke="{INK}" stroke-linejoin="round" stroke-linecap="round">'
        f'<g fill="{PAPER}" stroke-width="2.6">{"".join(front)}</g>'
        f'<path d="{back}" fill="none" stroke-width="1.3" stroke-dasharray="2.5 3.5"/></g>')


def spark():
    points = []
    for i in range(16):
        r = 44 if i % 2 == 0 else 19
        a = math.radians(i * 22.5 - 90)
        points.append(f"{50 + r * math.cos(a):.1f} {50 + r * math.sin(a):.1f}")
    svg("spark", "0 0 100 100",
        f'<path d="M{"L".join(points)}Z" fill="{CORAL}" stroke="{INK}" stroke-width="4.5" stroke-linejoin="round"/>')


def pointer():
    svg("pointer", "0 0 60 80",
        f'<path d="M8 5V61L22 48L32 72L43 67L33 44H52Z" fill="{PAPER}" stroke="{INK}" '
        'stroke-width="5" stroke-linejoin="round"/>')


for draw in (bxsb, relief, mesh, spark, pointer):
    draw()
