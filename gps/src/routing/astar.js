// routing/astar.js
function dist(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
  const h = s1*s1 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*s2*s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestNode(latlng, nodes) {
  let best = null, bestD = Infinity;
  for (const [id, p] of Object.entries(nodes)) {
    const d = dist({lat:latlng[0], lng:latlng[1]}, p);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

export function astar(nodes, edges, startId, goalId) {
  const open = new Set([startId]);
  const came = {};
  const g = {}; const f = {};
  for (const id in nodes) { g[id] = Infinity; f[id] = Infinity; }
  g[startId] = 0;
  f[startId] = dist(nodes[startId], nodes[goalId]);

  while (open.size) {
    let current = null, bestF = Infinity;
    for (const id of open) { if (f[id] < bestF) { bestF = f[id]; current = id; } }
    if (!current) break;
    if (current === goalId) {
      const path = [current];
      while (came[current]) { current = came[current]; path.unshift(current); }
      return path;
    }
    open.delete(current);

    for (const [nbr, w] of Object.entries(edges[current] || {})) {
      const tentative = g[current] + w;
      if (tentative < g[nbr]) {
        came[nbr] = current;
        g[nbr] = tentative;
        f[nbr] = tentative + dist(nodes[nbr], nodes[goalId]);
        open.add(nbr);
      }
    }
  }
  return null;
}
