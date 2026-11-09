export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];

/** Maps an upright unit square onto four clockwise card corners. */
export function cardProjection(points: Quad): (u: number, v: number) => Point {
  for (let i = 0; i < 4; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % 4]!;
    const c = points[(i + 2) % 4]!;
    if (
      ![a.x, a.y].every(Number.isFinite) ||
      a.x < 0 ||
      a.y < 0 ||
      a.x > 1 ||
      a.y > 1 ||
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < 0.0001
    )
      throw new Error(
        'Die vier Ecken müssen die Karte im Uhrzeigersinn umschließen.',
      );
  }
  const [p, q, r, s] = points;
  const dx = q.x - r.x,
    ex = s.x - r.x,
    fx = p.x - q.x + r.x - s.x;
  const dy = q.y - r.y,
    ey = s.y - r.y,
    fy = p.y - q.y + r.y - s.y;
  const determinant = dx * ey - ex * dy;
  const g = (fx * ey - ex * fy) / determinant;
  const h = (dx * fy - fx * dy) / determinant;
  return (u, v) => ({
    x:
      ((q.x - p.x + g * q.x) * u + (s.x - p.x + h * s.x) * v + p.x) /
      (g * u + h * v + 1),
    y:
      ((q.y - p.y + g * q.y) * u + (s.y - p.y + h * s.y) * v + p.y) /
      (g * u + h * v + 1),
  });
}
