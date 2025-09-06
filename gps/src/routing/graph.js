// routing/graph.js
// Updated with data from CSV file
// All lat/lng are Leaflet order: [lat, lng]

// -------------------------
// 1) Nodes (from CSV file)
// -------------------------
export const nodes = {
  // Main entry point
  ENTRY: { lat: 7.2522506, lng: 80.5933134 },
  
  // Regular nodes
  node1: { lat: 7.2522769, lng: 80.5930107 },
  node2: { lat: 7.2523099, lng: 80.5925297 },
  node3: { lat: 7.253893, lng: 80.5930046 },
  node4: { lat: 7.253888, lng: 80.5925685 },
  node5: { lat: 7.2546491, lng: 80.5929842 },
  node6: { lat: 7.2539049, lng: 80.5918411 },
  node7: { lat: 7.2523983, lng: 80.5918244 },
  node8: { lat: 7.253602, lng: 80.5925657 },
  node9: { lat: 7.255161, lng: 80.5918512 },
  node11: { lat: 7.2536083, lng: 80.5918348 },
  node12: { lat: 7.2545712, lng: 80.5918486 },
  node13: { lat: 7.254582, lng: 80.590999 },
  node14: { lat: 7.2543602, lng: 80.5918454 },
  node15: { lat: 7.254363, lng: 80.5909956 },
  node16: { lat: 7.2525371, lng: 80.5913015 },
  node17: { lat: 7.2526047, lng: 80.5913341 },
  node18: { lat: 7.2526144, lng: 80.591822 },
  node20: { lat: 7.2528299, lng: 80.5925466 },
  node21: { lat: 7.2535093, lng: 80.5925666 },
  node22: { lat: 7.2535073, lng: 80.5926689 },
  node23: { lat: 7.2537281, lng: 80.5926709 },
  node24: { lat: 7.2536023, lng: 80.5923867 },
  node25: { lat: 7.2551585, lng: 80.5923254 },
  node26: { lat: 7.2551605, lng: 80.5919811 },
  node27: { lat: 7.2548304, lng: 80.5918516 },
  node28: { lat: 7.2541129, lng: 80.5918422 },
  node29: { lat: 7.253762, lng: 80.5918395 },
  node30: { lat: 7.2531395, lng: 80.591828 },
  node31: { lat: 7.2528652, lng: 80.5918235 },
  node32: { lat: 7.2526822, lng: 80.5918215 },
  node33: { lat: 7.2528401, lng: 80.5918226 },

  // Entry points
  entry1: { lat: 7.2528292, lng: 80.5924876 },
  entry2: { lat: 7.2537276, lng: 80.5926815 },
  entry3: { lat: 7.2536518, lng: 80.5923843 },
  entry4: { lat: 7.255215, lng: 80.5923244 },
  entry5: { lat: 7.2551395, lng: 80.591982 },
  entry6: { lat: 7.2549027, lng: 80.5921742 },
  entry11: { lat: 7.2545876, lng: 80.5911806 },
  entry12: { lat: 7.2544743, lng: 80.5918208 },
  entry15: { lat: 7.2541129, lng: 80.591818 },
  entry18: { lat: 7.2534088, lng: 80.5918045 },
  entry20: { lat: 7.2537558, lng: 80.5918916 },
  entry22: { lat: 7.2537558, lng: 80.5918916 },

  // Exit points
  exit1: { lat: 7.2550741, lng: 80.5919847 },
  exit2: { lat: 7.2547083, lng: 80.592178 },
  exit8: { lat: 7.2549208, lng: 80.591239 },
  exit11: { lat: 7.2543721, lng: 80.5911913 },
  exit13: { lat: 7.2541256, lng: 80.5910651 },
  exit15: { lat: 7.2536693, lng: 80.5915177 },
  exit18: { lat: 7.2531408, lng: 80.5911244 },
  exit21: { lat: 7.2526826, lng: 80.5917957 },
  exit28: { lat: 7.2528382, lng: 80.5918521 },

  // Dual entry/exit points
  "entry,exit": { lat: 7.2548297, lng: 80.5918959 },
  "entry,exit ": { lat: 7.2548303, lng: 80.5918244 },
  "entry,exit17": { lat: 7.2535873, lng: 80.5916385 },
  "entry, exit 16": { lat: 7.2535514, lng: 80.5913871 },
  "exit 21": { lat: 7.2526826, lng: 80.5917957 }
};

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
// 3) Define a default chain (path) and build undirected edges
//     - This connects the points in a logical walking path
//     - Based on the CSV data structure
// ------------------------------------------------------
const defaultChain = [
  "ENTRY",
  "node1",
  "node2",
  "node7",
  "node16",
  "node17",
  "node18",
  "node20",
  "node21",
  "node22",
  "node23",
  "node24",
  "node8",
  "node3",
  "node4",
  "node5",
  "node6",
  "node9",
  "node11",
  "node12",
  "node13",
  "node14",
  "node15",
  "node25",
  "node26",
  "node27",
  "node28",
  "node29",
  "node30",
  "node31",
  "node32",
  "node33"
];

// Build an undirected adjacency map with weights computed from node coords
function buildEdgesFromChain(chain) {
  const g = {};
  const add = (a, b) => {
    if (!g[a]) g[a] = {};
    if (!g[b]) g[b] = {};
    const d = haversineMeters(nodes[a], nodes[b]);
    g[a][b] = d;
    g[b][a] = d;
  };
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    if (nodes[a] && nodes[b]) add(a, b);
  }
  return g;
}

// If you want to add extra "shortcuts" (cross-links), list them here:
const extraLinks = [
  // Connect nearby nodes for better pathfinding
  ["node1", "node2"],
  ["node2", "node7"],
  ["node7", "node16"],
  ["node16", "node17"],
  ["node17", "node18"],
  ["node18", "node20"],
  ["node20", "node21"],
  ["node21", "node22"],
  ["node22", "node23"],
  ["node23", "node24"],
  ["node24", "node8"],
  ["node8", "node3"],
  ["node3", "node4"],
  ["node4", "node5"],
  ["node5", "node6"],
  ["node6", "node9"],
  ["node9", "node11"],
  ["node11", "node12"],
  ["node12", "node13"],
  ["node13", "node14"],
  ["node14", "node15"],
  ["node15", "node25"],
  ["node25", "node26"],
  ["node26", "node27"],
  ["node27", "node28"],
  ["node28", "node29"],
  ["node29", "node30"],
  ["node30", "node31"],
  ["node31", "node32"],
  ["node32", "node33"],
  
  // Connect entry points to nearby nodes
  ["entry1", "node20"],
  ["entry2", "node22"],
  ["entry3", "node24"],
  ["entry4", "node25"],
  ["entry5", "node26"],
  ["entry6", "node27"],
  ["entry11", "node13"],
  ["entry12", "node27"],
  ["entry15", "node28"],
  ["entry18", "node29"],
  ["entry20", "node29"],
  ["entry22", "node29"],
  
  // Connect exit points to nearby nodes
  ["exit1", "node26"],
  ["exit2", "node27"],
  ["exit8", "node9"],
  ["exit11", "node13"],
  ["exit13", "node28"],
  ["exit15", "node29"],
  ["exit18", "node30"],
  ["exit21", "node32"],
  ["exit28", "node33"],
];
function addExtraLinks(g, links) {
  for (const [a, b] of links) {
    if (nodes[a] && nodes[b]) {
      const d = haversineMeters(nodes[a], nodes[b]);
      if (!g[a]) g[a] = {};
      if (!g[b]) g[b] = {};
      g[a][b] = d;
      g[b][a] = d;
    }
  }
  return g;
}

// Export the computed edges
export const edges = addExtraLinks(buildEdgesFromChain(defaultChain), extraLinks);

// ------------------------------------------------------
// 4) Building entrances (mapped from CSV entry points)
// ------------------------------------------------------
export const buildingEntrance = {
  // Main buildings mapped to their entry points
  "BUILDING_1": "entry1",
  "BUILDING_2": "entry2", 
  "BUILDING_3": "entry3",
  "BUILDING_4": "entry4",
  "BUILDING_5": "entry5",
  "BUILDING_6": "entry6",
  "BUILDING_11": "entry11",
  "BUILDING_12": "entry12",
  "BUILDING_15": "entry15",
  "BUILDING_18": "entry18",
  "BUILDING_20": "entry20",
  "BUILDING_22": "entry22",
  
  // Dual purpose entry/exit points
  "MAIN_ENTRANCE": "entry,exit",
  "SECONDARY_ENTRANCE": "entry,exit ",
  "BUILDING_16": "entry, exit 16",
  "BUILDING_17": "entry,exit17",
  
  // You can customize these building names based on your actual buildings
  // For example:
  // "LIBRARY": "entry1",
  // "LAB_BUILDING": "entry2",
  // "ADMIN_BUILDING": "entry3",
  // "CLASSROOM_BLOCK": "entry4",
};

// ------------------------------------------------------
// 5) Building exits (mapped from CSV exit points)
// ------------------------------------------------------
export const buildingExit = {
  // Main buildings mapped to their exit points
  "BUILDING_1": "exit1",
  "BUILDING_2": "exit2",
  "BUILDING_8": "exit8",
  "BUILDING_11": "exit11",
  "BUILDING_13": "exit13",
  "BUILDING_15": "exit15",
  "BUILDING_18": "exit18",
  "BUILDING_21": "exit21",
  "BUILDING_28": "exit28",
  
  // Dual purpose entry/exit points
  "MAIN_ENTRANCE": "entry,exit",
  "SECONDARY_ENTRANCE": "entry,exit ",
  "BUILDING_16": "entry, exit 16",
  "BUILDING_17": "entry,exit17",
  
  // You can customize these building names based on your actual buildings
  // For example:
  // "LIBRARY": "exit1",
  // "LAB_BUILDING": "exit2",
  // "ADMIN_BUILDING": "exit8",
  // "CLASSROOM_BLOCK": "exit11",
};

