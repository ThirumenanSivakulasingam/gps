// Utility to convert edited node data back to graph format
export function convertToGraphFormat(editedData) {
  const { nodes, paths } = editedData;
  
  // Convert nodes to graph format
  const graphNodes = {};
  Object.entries(nodes).forEach(([id, node]) => {
    graphNodes[id] = {
      lat: node.lat,
      lng: node.lng
    };
  });
  
  // Convert paths to edges format
  const edges = {};
  paths.forEach(path => {
    const { from, to, distance } = path;
    
    if (!edges[from]) edges[from] = {};
    if (!edges[to]) edges[to] = {};
    
    edges[from][to] = distance;
    edges[to][from] = distance;
  });
  
  // Generate building entrance mappings based on node types
  const buildingEntrance = {};
  const buildingExit = {};
  
  Object.entries(nodes).forEach(([id, node]) => {
    if (node.type === 'entry') {
      buildingEntrance[`BUILDING_${id.toUpperCase()}`] = id;
    } else if (node.type === 'exit') {
      buildingExit[`BUILDING_${id.toUpperCase()}`] = id;
    }
  });
  
  return {
    nodes: graphNodes,
    edges: edges,
    buildingEntrance: buildingEntrance,
    buildingExit: buildingExit
  };
}

// Generate the graph.js content
export function generateGraphJSContent(graphData) {
  return `// routing/graph.js
// Auto-generated from Node Editor
// Generated on: ${new Date().toISOString()}

// -------------------------
// 1) Nodes (from Node Editor)
// -------------------------
export const nodes = ${JSON.stringify(graphData.nodes, null, 2)};

// ----------------------------------------
// 2) Helper: distance in meters (Haversine)
// ----------------------------------------
function haversineMeters(a, b) {
  const R = 6371000; // Earth radius (m)
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// ------------------------------------------------------
// 3) Edges (from Node Editor paths)
// ------------------------------------------------------
export const edges = ${JSON.stringify(graphData.edges, null, 2)};

// ------------------------------------------------------
// 4) Building entrances (from Node Editor)
// ------------------------------------------------------
export const buildingEntrance = ${JSON.stringify(graphData.buildingEntrance, null, 2)};

// ------------------------------------------------------
// 5) Building exits (from Node Editor)
// ------------------------------------------------------
export const buildingExit = ${JSON.stringify(graphData.buildingExit, null, 2)};
`;
}

// Export function to save the updated graph.js
export function exportUpdatedGraphJS(editedData) {
  const graphData = convertToGraphFormat(editedData);
  const content = generateGraphJSContent(graphData);
  
  const blob = new Blob([content], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'updated_graph.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

