/**
 * Google Polyline Algorithm encoder (precision 5) — compatível com Mapbox Static.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

function encodeNum(n: number): string {
  let v = n < 0 ? ~(n << 1) : n << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export function encodePolyline(points: LatLng[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += encodeNum(lat - lastLat) + encodeNum(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

/**
 * Douglas-Peucker pra reduzir pontos mantendo a forma. Necessário porque
 * a URL do Mapbox Static tem limite de ~8192 chars.
 * `epsilon` em graus (≈ 0.00005 = 5m).
 */
export function simplify(points: LatLng[], epsilon = 0.00005): LatLng[] {
  if (points.length < 3) return points;
  const sqEpsilon = epsilon * epsilon;

  const stack: [number, number][] = [[0, points.length - 1]];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    const a = points[first];
    const b = points[last];
    for (let i = first + 1; i < last; i++) {
      const d = perpDistSq(points[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > sqEpsilon && index !== -1) {
      keep[index] = 1;
      stack.push([first, index]);
      stack.push([index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function perpDistSq(p: LatLng, a: LatLng, b: LatLng): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    const ex = p.lng - a.lng;
    const ey = p.lat - a.lat;
    return ex * ex + ey * ey;
  }
  const t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
  const tx = a.lng + t * dx;
  const ty = a.lat + t * dy;
  const ex = p.lng - tx;
  const ey = p.lat - ty;
  return ex * ex + ey * ey;
}
