import { haversineMeters, toXY } from "../utils/geo";

// Project point P onto segment AB (in local XY meters)
function projectPointToSegment(p, a, b) {
  const APx = p.x - a.x, APy = p.y - a.y;
  const ABx = b.x - a.x, ABy = b.y - a.y;
  const ab2 = ABx*ABx + ABy*ABy || 1e-9;
  let t = (APx*ABx + APy*ABy) / ab2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t*ABx, y: a.y + t*ABy, t };
}

// Find nearest node or edge; create a virtual node on an edge if closer.
// returns { type: 'node'|'virtual', nodeId, coord, attach: {a,b,distA,distB}? }
export function snapToGraph(coord, nodes, edges) {
  // 1) nearest node
  let bestNode = null, bestNodeDist = Infinity;
  for (const [id, n] of Object.entries(nodes)) {
    const d = haversineMeters(coord, n);
    if (d < bestNodeDist) { bestNodeDist = d; bestNode = id; }
  }

  // 2) nearest edge via projection in local XY
  // choose a reference latitude to reduce distortion
  const refLat = coord.lat;
  const pXY = toXY(coord.lat, coord.lng, refLat);
  let bestEdge = null;

  for (const [a, list] of Object.entries(edges)) {
    for (const b of Object.keys(list)) {
      if (a >= b) continue; // undirected, check once
      const A = nodes[a], B = nodes[b];
      if (!A || !B) continue;
      const aXY = toXY(A.lat, A.lng, refLat);
      const bXY = toXY(B.lat, B.lng, refLat);
      const proj = projectPointToSegment(pXY, aXY, bXY);
      const projCoord = xyToLatLng(proj.x, proj.y, refLat);
      const d = haversineMeters(coord, projCoord);
      if (!bestEdge || d < bestEdge.dist) {
        bestEdge = { a, b, proj, coord: projCoord, dist: d };
      }
    }
  }

  // prefer edge if significantly closer than nearest node
  if (bestEdge && bestEdge.dist + 0.1 < bestNodeDist) {
    const id = `VIRTUAL_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    return {
      type: 'virtual',
      nodeId: id,
      coord: bestEdge.coord,
      attach: { a: bestEdge.a, b: bestEdge.b }
    };
  }
  return { type: 'node', nodeId: bestNode, coord: nodes[bestNode] };
}

// helper: inverse of toXY
function xyToLatLng(x, y, refLat) {
  const R = 6371000;
  const lat = (y / R) * 180/Math.PI;
  const lng = (x / (R * Math.cos(refLat * Math.PI/180))) * 180/Math.PI;
  return { lat, lng };
}
