// routing/graph.js
// All lat/lng are Leaflet order: [lat, lng]. The PDF listed (lng lat); flipped here.
// Source: your uploaded WKT list (see citation in chat).

// -------------------------
// 1) Nodes (from the PDF)
// -------------------------
export const nodes = {
  // Named entry
  E0_ENTRY: { lat: 7.252254, lng: 80.593298 }, // "entry op"

  // Simple named points (duplicates disambiguated with A/B/C)
  P2:   { lat: 7.2523006, lng: 80.5930137 },     // "Point 2"
  P3A:  { lat: 7.2523405, lng: 80.5925229 },     // "Point 3"
  P28A: { lat: 7.2528175, lng: 80.5925312 },     // "28"
  P25A: { lat: 7.2537212, lng: 80.5926762 },     // "25"

  P22A: { lat: 7.2536653, lng: 80.5923919 },     // "22"
  P22B: { lat: 7.2538516, lng: 80.5923838 },     // "22"
  P22C: { lat: 7.2537499, lng: 80.5918876 },     // "22"

  P15A: { lat: 7.2537774, lng: 80.5918066 },     // "15"
  P15B: { lat: 7.2536763, lng: 80.5914880 },     // "15"

  P17A: { lat: 7.2535981, lng: 80.5916378 },     // "17"
  P17B: { lat: 7.2535918, lng: 80.5916378 },     // "17"

  P16A: { lat: 7.2536000, lng: 80.5913682 },     // "16"
  P16B: { lat: 7.2535867, lng: 80.5913696 },     // "16"

  P18A: { lat: 7.2534095, lng: 80.5918001 },     // "18"
  P18B: { lat: 7.2534123, lng: 80.5911017 },     // "18"

  HV1:  { lat: 7.2547422, lng: 80.5909994 },     // "HighVoltage"
  HV2:  { lat: 7.2547110, lng: 80.5909977 },     // "HighVoltage"

  P13A: { lat: 7.2541172, lng: 80.5918183 },     // "13"
  P13B: { lat: 7.2541086, lng: 80.5910632 },     // "13"

  P12A: { lat: 7.2544530, lng: 80.5918204 },     // "12"
  P11A: { lat: 7.2543811, lng: 80.5912401 },     // "11"
  P11B: { lat: 7.2545753, lng: 80.5912160 },     // "11"
  P12B: { lat: 7.2545647, lng: 80.5914627 },     // "12"

  P8A:  { lat: 7.2549063, lng: 80.5911426 },     // "8"
  P8B:  { lat: 7.2548239, lng: 80.5917997 },     // "8"

  P3B:  { lat: 7.2548287, lng: 80.5919158 },     // "3"
  P3C:  { lat: 7.2548074, lng: 80.5919131 },     // "3"

  P2B:  { lat: 7.2551121, lng: 80.5921875 },     // "2"
  P2C:  { lat: 7.2549418, lng: 80.5922023 },     // "2"

  P3D:  { lat: 7.2549006, lng: 80.5921782 },     // "3"
  P3E:  { lat: 7.2547103, lng: 80.5921768 },     // "3"

  P1A:  { lat: 7.2552127, lng: 80.5922964 },     // "1"
  P1B:  { lat: 7.2552166, lng: 80.5923233 },     // "1"

  P6A:  { lat: 7.2541784, lng: 80.5920549 },     // "6"
  P6B:  { lat: 7.2539602, lng: 80.5920723 },     // "6"

  P25B: { lat: 7.2536933, lng: 80.5926735 },     // "25"
  P28B: { lat: 7.2528340, lng: 80.5921532 },     // "28"

  P14A: { lat: 7.2539364, lng: 80.5916830 },     // "14"
  P14B: { lat: 7.2539684, lng: 80.5917326 },     // "14"
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
//     - This connects the points in the order they appeared
//     - Adjust/add branches as you refine the walkway graph
// ------------------------------------------------------
const defaultChain = [
  "E0_ENTRY",
  "P2",
  "P3A",
  "P28A",
  "P25A",
  "P22A",
  "P22B",
  "P22C",
  "P15A",
  "P15B",
  "P17A",
  "P17B",
  "P16A",
  "P16B",
  "P18A",
  "P18B",
  "HV1",
  "HV2",
  "P13A",
  "P13B",
  "P12A",
  "P11A",
  "P11B",
  "P12B",
  "P8A",
  "P8B",
  "P3B",
  "P3C",
  "P2B",
  "P2C",
  "P3D",
  "P3E",
  "P1A",
  "P1B",
  "P6A",
  "P6B",
  "P25B",
  "P28B",
  "P14A",
  "P14B",
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

// If you want to add extra “shortcuts” (cross-links), list them here:
const extraLinks = [
  // ["P22B", "P14A"],
  // ["P25A", "P25B"],
  // ["P3E", "P6A"],
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
// 4) Building entrances (fill as you map buildings -> nodes)
// ------------------------------------------------------
export const buildingEntrance = {
  // Example:
  // "EE_DEPT": "P22B",
  // "CIVIL_DEPT": "P15A",
  // "LIBRARY": "P3D",
};

