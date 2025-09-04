import { dijkstra } from "./dijkstra";
import { snapToGraph } from "./snap";
import { haversineMeters, pointInPolygon } from "../utils/geo";
import { nodes, edges, buildingEntrance } from "./graph";
import { buildingPolygons, buildingExit } from "./mapdata"; // you create this

// Build a temporary graph if a virtual node is used
function withVirtualNode(baseEdges, virtual) {
  if (!virtual) return baseEdges;
  const g = JSON.parse(JSON.stringify(baseEdges));
  const { a, b } = virtual.attach;
  const id = virtual.nodeId;

  // distances from virtual to a/b along the original edge length proportions
  const dA = haversineMeters(virtual.coord, nodes[a]);
  const dB = haversineMeters(virtual.coord, nodes[b]);
  // connect virtual both ways
  g[id] = { [a]: dA, [b]: dB };
  g[a] = { ...(g[a]||{}), [id]: dA };
  g[b] = { ...(g[b]||{}), [id]: dB };
  return g;
}

export function computeRoute({ userCoord, destBuildingId }) {
  // 1) decide origin node
  let originNodeId;
  let virtual = null;

  // Check if user is inside ANY building polygon
  let insideBuildingId = null;
  for (const [bid, poly] of Object.entries(buildingPolygons)) {
    if (pointInPolygon(userCoord, poly)) { insideBuildingId = bid; break; }
  }

  if (insideBuildingId) {
    // Start from that building's exit node
    originNodeId = buildingExit[insideBuildingId];
  } else {
    // Snap user's location to graph (node or virtual on an edge)
    const snap = snapToGraph(userCoord, nodes, edges);
    if (snap.type === "node") {
      originNodeId = snap.nodeId;
    } else {
      virtual = snap;
      originNodeId = snap.nodeId;
    }
  }

  // 2) destination node = entrance of target building
  const destNodeId = buildingEntrance[destBuildingId];
  if (!destNodeId) {
    return { ok: false, error: `No entrance node for ${destBuildingId}` };
  }

  // 3) run Dijkstra on a graph augmented with virtual node (if any)
  const g = withVirtualNode(edges, virtual);
  const { path, distance } = dijkstra(g, originNodeId, destNodeId);
  if (!path.length) return { ok: false, error: "No path found" };

  // 4) create polyline coordinates for Leaflet
  const coords = path.map(id => id.startsWith("VIRTUAL") ? virtual.coord : nodes[id]);

  return {
    ok: true,
    pathNodeIds: path,
    distanceMeters: Math.round(distance),
    polyline: coords,
    startedInsideBuilding: Boolean(insideBuildingId),
    startBuilding: insideBuildingId || null,
    originNodeId,
    destNodeId
  };
}
