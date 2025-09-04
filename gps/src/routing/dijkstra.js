// Dijkstra for edges: { A: {B: w, ...}, ... }
export function dijkstra(edges, start, goal) {
  const dist = {}, prev = {}, visited = new Set();
  const pq = new Set(Object.keys(edges));
  for (const k of pq) dist[k] = Infinity;
  dist[start] = 0;

  while (pq.size) {
    // get node with smallest dist
    let u = null, best = Infinity;
    for (const n of pq) if (dist[n] < best) { best = dist[n]; u = n; }
    if (u == null) break;
    pq.delete(u);
    if (u === goal) break;
    visited.add(u);

    for (const [v, w] of Object.entries(edges[u] || {})) {
      if (visited.has(v)) continue;
      const alt = dist[u] + w;
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    }
  }

  if (!prev[goal] && start !== goal) return { path: [], distance: Infinity };
  // reconstruct
  const path = [goal];
  let cur = goal;
  while (cur !== start) { cur = prev[cur]; path.push(cur); }
  path.reverse();
  return { path, distance: dist[goal] };
}
