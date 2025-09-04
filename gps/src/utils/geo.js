// Haversine and small helpers
export function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// rough equirectangular projection for local campus distances (fast)
export function toXY(lat, lng, refLat = lat) {
  const R = 6371000;
  const x = toRad(lng) * R * Math.cos(toRad(refLat));
  const y = toRad(lat) * R;
  function toRad(d){ return d * Math.PI / 180; }
  return {x, y};
}

// point-in-polygon (ray casting). polygon = [[lat,lng], ...]
export function pointInPolygon(point, polygon) {
  const {lat, lng} = point;
  let inside = false;
  for (let i=0, j=polygon.length-1; i<polygon.length; j=i++) {
    const [lati, lngi] = polygon[i];
    const [latj, lngj] = polygon[j];
    const intersect = ((lngi > lng) !== (lngj > lng)) &&
      (lat < (latj - lati) * (lng - lngi) / (lngj - lngi + 1e-12) + lati);
    if (intersect) inside = !inside;
  }
  return inside;
}
