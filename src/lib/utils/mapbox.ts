import { env } from '$env/dynamic/public';
import { encodePolyline, simplify, type LatLng } from './polyline';

/**
 * Constrói URL pro Mapbox Static Images API com a rota desenhada em cima.
 * Docs: https://docs.mapbox.com/api/maps/static-images/
 *
 * Simplifica a rota progressivamente até caber no limite de ~8k chars da URL.
 */
export function buildStaticMapUrl(params: {
  track: LatLng[];
  width: number;
  height: number;
  style?: string; // ex: 'mapbox/outdoors-v12', 'mapbox/satellite-streets-v12'
  strokeColor?: string; // hex sem #
  strokeWidth?: number;
}): string | null {
  const token = env.PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  if (params.track.length < 2) return null;

  const style = params.style ?? 'mapbox/outdoors-v12';
  const color = params.strokeColor ?? '22d3ee';
  const width = params.strokeWidth ?? 5;

  // Tenta com epsilon crescente até URL ficar abaixo do limite
  const epsilons = [0.000015, 0.00003, 0.00006, 0.0001, 0.0002, 0.0005];
  for (const eps of epsilons) {
    const simplified = simplify(params.track, eps);
    const encoded = encodePolyline(simplified);
    const pathOverlay = `path-${width}+${color}-1(${encodeURIComponent(encoded)})`;
    const url =
      `https://api.mapbox.com/styles/v1/${style}/static/` +
      `${pathOverlay}/auto/${params.width}x${params.height}@2x?` +
      `access_token=${token}&padding=60,40,140,40&logo=false&attribution=false`;
    if (url.length < 8000) return url;
  }
  return null;
}
