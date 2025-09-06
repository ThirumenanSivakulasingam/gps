// MapWithGeoSvg.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Pane, useMap, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import LocationWatcher from "./components/LocationWatcher";
import NodeEditor from "./components/NodeEditor";
import { dijkstra } from "./routing/dijkstra";
import { nearestNode } from "./routing/astar";
import { nodes, edges, buildingEntrance } from "./routing/graph";

/* ---------------- Offset helpers (meters → degrees) ---------------- */
function metersToDegLat(m) { return m / 111320; } // ~111,320 m / deg
function metersToDegLng(m, atLat) {
  return m / (111320 * Math.cos((atLat * Math.PI) / 180));
}
function nudgeBounds(bounds, dyMeters = 0, dxMeters = 0) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const midLat = (sw.lat + ne.lat) / 2;

  const dLat = metersToDegLat(dyMeters);         // +north, -south
  const dLng = metersToDegLng(dxMeters, midLat); // +east,  -west

  const sw2 = L.latLng(sw.lat + dLat, sw.lng + dLng);
  const ne2 = L.latLng(ne.lat + dLat, ne.lng + dLng);
  return L.latLngBounds(sw2, ne2);
}
/* ------------------------------------------------------------------ */

/** ---------- Campus bounds (convert TL/BR -> SW/NE) ---------- */
const TOP_LEFT = [7.255565, 80.590510];       // [latN, lngW]
const BOTTOM_RIGHT = [7.251971, 80.593542];   // [latS, lngE]
const SW = [BOTTOM_RIGHT[0], TOP_LEFT[1]];
const NE = [TOP_LEFT[0], BOTTOM_RIGHT[1]];
const RAW_BOUNDS = L.latLngBounds(SW, NE);

// If you still need a small alignment nudge, edit these:
const DY_METERS = 0;  // negative = move SVG south (down), positive = north (up)
const DX_METERS = 0;  // positive = east (right), negative = west (left)
const BOUNDS = nudgeBounds(RAW_BOUNDS, DY_METERS, DX_METERS);
/* ------------------------------------------------------------ */

/** SVG overlay with opacity + click forwarding + (optional) user dot hook */
function SvgOverlayLoader({ url, bounds, pane = "svgPane", opacity = 1, onPick, userPos }) {
  const map = useMap();
  const overlayRef = useRef(null);  // L.SVGOverlay
  const svgRef = useRef(null);      // <svg> element inside overlay

  // Create overlay once (per URL/pane)
  useEffect(() => {
    let cancelled = false;
    let listeners = [];

    (async () => {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
        const txt = await res.text();
        if (cancelled) return;

        const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
        const bad = doc.getElementsByTagName("parsererror").length > 0;
        if (bad || doc.documentElement.nodeName.toLowerCase() !== "svg") {
          throw new Error("Not a valid SVG. Check the file/path.");
        }

        const svgEl = doc.documentElement;
        if (!svgEl.getAttribute("xmlns")) {
          svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        }

        // Make only building-like shapes clickable (not paths or other elements)
        svgEl.querySelectorAll("[id]").forEach((el) => {
          const raw = el.id || "";
          const m = raw.match(/b(\d+)/i);
          const buildingId = m ? `B${m[1]}` : (el.getAttribute("data-name") || raw);
          
          // Only make elements clickable if they have a defined entrance
          // or if they look like buildings (contain 'building', 'bldg', 'dept', etc.)
          const isBuilding = buildingId.toLowerCase().includes('building') || 
                           buildingId.toLowerCase().includes('bldg') ||
                           buildingId.toLowerCase().includes('dept') ||
                           buildingId.toLowerCase().includes('hall') ||
                           buildingId.toLowerCase().includes('center') ||
                           buildingId.toLowerCase().includes('lab') ||
                           m; // or if it matches the B\d+ pattern
          
          if (isBuilding) {
            el.style.cursor = "pointer";
            const handler = () => {
              onPick?.(buildingId);
            };
            el.addEventListener("click", handler);
            listeners.push({ el, handler });
          }
        });

        const ov = L.svgOverlay(svgEl, bounds, {
          interactive: true,
          pane,
          opacity,               // ← initial opacity
        }).addTo(map);

        overlayRef.current = ov;
        svgRef.current = ov.getElement();

        map.fitBounds(bounds);
        map.setMaxBounds(bounds.pad(0.25));
      } catch (e) {
        console.error(e);
        alert(`Could not load SVG overlay:\n${e.message}`);
      }
    })();

    return () => {
      cancelled = true;
      listeners.forEach(({ el, handler }) => el.removeEventListener("click", handler));
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
        svgRef.current = null;
      }
    };
  }, [map, url, pane, bounds, onPick, opacity]);

  // If opacity prop changes later, update overlay without recreating
  useEffect(() => {
    if (overlayRef.current && typeof overlayRef.current.setOpacity === "function") {
      overlayRef.current.setOpacity(opacity);
    } else if (svgRef.current) {
      // fallback: set directly on the <svg> element
      svgRef.current.style.opacity = String(opacity);
    }
  }, [opacity]);

  // (Optional) If you want to draw a dot INSIDE the SVG using userPos, you can re-add
  // the user-dot effect we had earlier here, using svgRef.current. Skipped for brevity.

  return null;
}

/** ========================= Main component ========================= */
export default function MapWithGeoSvg() {
  const [userPos, setUserPos] = useState(null);  // [lat, lng]
  const [route, setRoute] = useState([]);        // [[lat,lng], ...]
  const [svgOpacity, setSvgOpacity] = useState(1.0); // ← SVG opacity state (0..1)
  const [showGraphPoints, setShowGraphPoints] = useState(false); // ← Graph points toggle
  const [nodeEditorActive, setNodeEditorActive] = useState(false); // ← Node editor toggle
  const [showGraphEdges, setShowGraphEdges] = useState(true);    // ← Graph edges toggle
  const [showGraphLabels, setShowGraphLabels] = useState(true);  // ← Graph labels toggle
  
  // All node editing is now handled by the NodeEditor component

  const center = useMemo(() => BOUNDS.getCenter(), []);

  // Graph visualization data
  const entranceNodeIds = useMemo(() => new Set(Object.values(buildingEntrance || {})), []);
  
  const graphEdgeSegments = useMemo(() => {
    if (!showGraphPoints || !showGraphEdges) return [];
    const segs = [];
    for (const [a, nbrs] of Object.entries(edges || {})) {
      for (const b of Object.keys(nbrs)) {
        if (a < b && nodes[a] && nodes[b]) {
          segs.push([[nodes[a].lat, nodes[a].lng], [nodes[b].lat, nodes[b].lng]]);
        }
      }
    }
    return segs;
  }, [showGraphPoints, showGraphEdges]);

  const handleBuildingPick = (buildingId) => {
    // Check if this is a valid building with an entrance defined
    const destNode = buildingEntrance[buildingId];
    if (!destNode) {
      // Silently ignore clicks on paths or elements without defined entrances
      console.log(`Clicked on ${buildingId} - no entrance defined, ignoring`);
      return;
    }
    
    if (!userPos) {
      alert("Enable location first to route from your position.");
      return;
    }
    
    const startNode = nearestNode(userPos, nodes);
    const pathIds = dijkstra(nodes, edges, startNode, destNode);
    if (!pathIds || pathIds.length === 0) {
      alert("No path found.");
      setRoute([]);
      return;
    }
    setRoute(pathIds.map((id) => [nodes[id].lat, nodes[id].lng]));
  };

  // All node creation is now handled by the NodeEditor component

  const addNodeManually = () => {
    const { lat, lng, id } = manualInput;
    if (!lat || !lng || !id) {
      alert("Please fill in all fields");
      return;
    }
    
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      alert("Please enter valid coordinates");
      return;
    }
    
    const newNode = { lat: latNum, lng: lngNum, id };
    setCustomNodes(prev => ({
      ...prev,
      [id]: newNode
    }));
    
    setSelectedNode(id);
    setManualInput({ lat: '', lng: '', id: '' });
  };

  const deleteNode = (nodeId) => {
    if (window.confirm(`Are you sure you want to delete custom node "${nodeId}"?`)) {
      setCustomNodes(prev => {
        const newNodes = { ...prev };
        delete newNodes[nodeId];
        return newNodes;
      });
      
      if (selectedNode === nodeId) {
        setSelectedNode(null);
      }
    }
  };

  const updateNode = (nodeId, updates) => {
    setCustomNodes(prev => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], ...updates }
    }));
  };

  const exportCustomNodes = () => {
    const nodesArray = Object.values(customNodes);
    const jsonString = JSON.stringify(nodesArray, null, 2);
    
    // Create and download file
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom_nodes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Existing node editing functions
  const handleExistingNodeClick = (nodeId) => {
    if (!editMode) return;
    setSelectedExistingNode(selectedExistingNode === nodeId ? null : nodeId);
  };

  const updateExistingNode = (nodeId, newLat, newLng) => {
    setEditableNodes(prev => ({
      ...prev,
      [nodeId]: { lat: newLat, lng: newLng }
    }));
  };

  const resetExistingNode = (nodeId) => {
    setEditableNodes(prev => {
      const newNodes = { ...prev };
      delete newNodes[nodeId];
      return newNodes;
    });
    if (selectedExistingNode === nodeId) {
      setSelectedExistingNode(null);
    }
  };

  const resetAllExistingNodes = () => {
    setEditableNodes({});
    setSelectedExistingNode(null);
  };

  const deleteExistingNode = (nodeId) => {
    if (window.confirm(`Are you sure you want to delete node "${nodeId}"? This will remove it from the graph permanently.`)) {
      // Add to deleted nodes list for export
      setEditableNodes(prev => ({
        ...prev,
        [nodeId]: { deleted: true }
      }));
      setSelectedExistingNode(null);
    }
  };

  const exportUpdatedGraph = () => {
    // Merge original nodes with edited nodes, excluding deleted ones
    const updatedNodes = { ...nodes };
    const deletedNodes = [];
    
    Object.entries(editableNodes).forEach(([nodeId, coords]) => {
      if (coords.deleted) {
        // Mark as deleted
        deletedNodes.push(nodeId);
        delete updatedNodes[nodeId];
      } else if (updatedNodes[nodeId]) {
        // Update coordinates
        updatedNodes[nodeId] = { ...updatedNodes[nodeId], ...coords };
      }
    });

    // Create the updated graph.js content
    const graphContent = `// routing/graph.js
// All lat/lng are Leaflet order: [lat, lng]. The PDF listed (lng lat); flipped here.
// Source: your uploaded WKT list (see citation in chat).

// -------------------------
// 1) Nodes (from the PDF) - UPDATED
// -------------------------
export const nodes = {
${Object.entries(updatedNodes).map(([id, coords]) => 
  `  ${id}: { lat: ${coords.lat}, lng: ${coords.lng} },`
).join('\n')}
};

// Deleted nodes: ${deletedNodes.length > 0 ? deletedNodes.join(', ') : 'None'}

// ... rest of your graph.js content remains the same
// (edges, buildingEntrance, etc.)
`;

    // Create and download file
    const blob = new Blob([graphContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'updated_graph.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get the current coordinates for a node (either edited or original)
  const getCurrentNodeCoords = (nodeId) => {
    return editableNodes[nodeId] || nodes[nodeId];
  };

  // helper to clamp and set opacity
  function adjustOpacity(value) {
    const v = Math.max(0, Math.min(1, value));
    setSvgOpacity(v);
  }

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <MapContainer
        style={{ height: "100%", width: "100%" }}
        center={center}
        zoom={17}
        maxZoom={22}
        maxBounds={BOUNDS.pad(0.25)}
        zoomControl
        eventHandlers={{
          click: handleMapClick
        }}
      >
        {/* stacking: SVG lower, routes/markers higher */}
        <Pane name="svgPane" style={{ zIndex: 350 }} />
        <Pane name="routesPane" style={{ zIndex: 650 }} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={22}
        />

        {/* Faculty SVG (lower pane) with adjustable opacity */}
        <SvgOverlayLoader
          url="/map.svg"               // or import svgUrl from "./assets/map.svg?url"
          bounds={BOUNDS}
          pane="svgPane"
          opacity={svgOpacity}         // ← apply opacity state
          onPick={handleBuildingPick}
          userPos={userPos}
        />

        {/* Graph visualization (when enabled) */}
        {showGraphPoints && graphEdgeSegments.map((seg, i) => (
          <Polyline key={`graph-edge-${i}`} positions={seg} pathOptions={{ weight: 2, opacity: 0.7, color: "blue" }} pane="routesPane" />
        ))}

        {showGraphPoints && Object.entries(nodes).map(([id, n]) => {
          const isEntrance = entranceNodeIds.has(id);
          const currentCoords = getCurrentNodeCoords(id);
          const isSelected = selectedExistingNode === id;
          const isEdited = editableNodes[id] && !editableNodes[id].deleted;
          const isDeleted = editableNodes[id]?.deleted;
          
          // Don't render deleted nodes
          if (isDeleted) return null;
          
          return (
            <CircleMarker
              key={`graph-node-${id}`}
              center={[currentCoords.lat, currentCoords.lng]}
              radius={isSelected ? 8 : 6}
              pathOptions={{
                color: isSelected ? "orange" : (isEntrance ? "green" : "red"),
                fillOpacity: 0.9,
                weight: isSelected ? 3 : 1.5
              }}
              pane="routesPane"
              eventHandlers={{
                click: () => handleExistingNodeClick(id)
              }}
            >
              {showGraphLabels && (
                <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent>
                  <div style={{ fontWeight: 600 }}>{id}</div>
                  <div style={{ fontSize: 11 }}>
                    {currentCoords.lat.toFixed(6)}, {currentCoords.lng.toFixed(6)}
                  </div>
                  {isEdited && (
                    <div style={{ fontSize: 10, color: "#ff6b35" }}>
                      ✏️ Modified
                    </div>
                  )}
                  {editMode && (
                    <div style={{ fontSize: 10, color: "#666" }}>
                      {isSelected ? "Selected" : "Click to edit"}
                    </div>
                  )}
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}

        {/* Custom nodes visualization */}
        {Object.entries(customNodes).map(([id, node]) => (
          <CircleMarker
            key={`custom-node-${id}`}
            center={[node.lat, node.lng]}
            radius={8}
            pathOptions={{
              color: selectedNode === id ? "orange" : "purple",
              fillOpacity: 0.9,
              weight: 2
            }}
            pane="routesPane"
            eventHandlers={{
              click: () => setSelectedNode(selectedNode === id ? null : id)
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent>
              <div style={{ fontWeight: 600 }}>{node.id}</div>
              <div style={{ fontSize: 11 }}>
                {node.lat.toFixed(6)}, {node.lng.toFixed(6)}
              </div>
              <div style={{ fontSize: 10, color: "#666" }}>
                Click to select • {selectedNode === id ? "Selected" : "Click to select"}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* User live location & route (drawn on top) */}
        <LocationWatcher 
          onMove={setUserPos} 
          pane="routesPane"
          accuracyMax={150}  // Increased from 100m to 150m for better reliability
          staleMs={15000}    // Increased from 10s to 15s for better reliability
          ema={0.3}          // Slightly more smoothing for noisy GPS
          jumpGuard={12}     // Increased from 8 m/s to 12 m/s (43 km/h) for faster movement
          reportRaw={(ll, acc) => {
            console.log('GPS Fix:', ll, 'Accuracy:', acc, 'm');
          }}
        />

        {route.length > 1 && (
          <Polyline positions={route} weight={6} opacity={0.95} pane="routesPane" />
        )}

        {/* Node Editor Component */}
        <NodeEditor 
          isActive={nodeEditorActive}
          onNodesUpdate={(nodes) => console.log('Nodes updated:', nodes)}
          onPathsUpdate={(paths) => console.log('Paths updated:', paths)}
        />
      </MapContainer>

      {/* Controls UI (top-right) */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1000,
          background: "white",
          padding: "8px 12px",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,.15)",
          minWidth: 200
        }}
      >
        {/* Location Status */}
        <div style={{ fontSize: 11, marginBottom: 8, padding: "4px", backgroundColor: userPos ? "#e8f5e8" : "#ffe8e8", borderRadius: 4 }}>
          📍 Location: {userPos ? `Active (${userPos[0].toFixed(6)}, ${userPos[1].toFixed(6)})` : "Not detected"}
        </div>

        {/* SVG Opacity Control */}
        <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
          SVG Opacity: {svgOpacity.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={svgOpacity}
          onChange={(e) => adjustOpacity(parseFloat(e.target.value))}
          style={{ width: "100%", marginBottom: 12 }}
        />

        {/* Node Editor Toggle */}
        <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
          <input 
            type="checkbox" 
            checked={nodeEditorActive} 
            onChange={e => setNodeEditorActive(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Node Editor
        </label>

        {/* Graph Points Toggle */}
        <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
          <input 
            type="checkbox" 
            checked={showGraphPoints} 
            onChange={e => setShowGraphPoints(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Show Graph Points
        </label>

        {/* Graph Edges Toggle (only show when graph points are enabled) */}
        {showGraphPoints && (
          <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
            <input 
              type="checkbox" 
              checked={showGraphEdges} 
              onChange={e => setShowGraphEdges(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show Graph Edges
          </label>
        )}

        {/* Graph Labels Toggle (only show when graph points are enabled) */}
        {showGraphPoints && (
          <label style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
            <input 
              type="checkbox" 
              checked={showGraphLabels} 
              onChange={e => setShowGraphLabels(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show Graph Labels
          </label>
        )}

        {/* Existing Node Editing Section */}
        <div style={{ borderTop: "1px solid #ddd", paddingTop: 12, marginTop: 12 }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: "bold" }}>Edit Existing Nodes</h4>
          
          {/* Edit Mode Toggle */}
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
            <input 
              type="checkbox" 
              checked={editMode} 
              onChange={e => setEditMode(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Enable Node Editing
          </label>

          {/* Selected Existing Node Editor */}
          {selectedExistingNode && editMode && (
            <div style={{ 
              backgroundColor: "#e3f2fd", 
              padding: "8px", 
              borderRadius: 4, 
              fontSize: 11,
              marginBottom: 8
            }}>
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                Editing: {selectedExistingNode}
              </div>
              <div style={{ marginBottom: 4 }}>
                <input
                  type="number"
                  placeholder="Latitude"
                  step="0.000001"
                  value={editableNodes[selectedExistingNode]?.lat || nodes[selectedExistingNode]?.lat || ''}
                  onChange={e => updateExistingNode(selectedExistingNode, parseFloat(e.target.value) || 0, editableNodes[selectedExistingNode]?.lng || nodes[selectedExistingNode]?.lng)}
                  style={{ width: "48%", padding: "3px", marginRight: "2%", fontSize: 10 }}
                />
                <input
                  type="number"
                  placeholder="Longitude"
                  step="0.000001"
                  value={editableNodes[selectedExistingNode]?.lng || nodes[selectedExistingNode]?.lng || ''}
                  onChange={e => updateExistingNode(selectedExistingNode, editableNodes[selectedExistingNode]?.lat || nodes[selectedExistingNode]?.lat, parseFloat(e.target.value) || 0)}
                  style={{ width: "48%", padding: "3px", marginLeft: "2%", fontSize: 10 }}
                />
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => resetExistingNode(selectedExistingNode)}
                  style={{ 
                    flex: 1,
                    padding: "3px", 
                    fontSize: 9,
                    backgroundColor: "#ff9800",
                    color: "white",
                    border: "none",
                    borderRadius: 2,
                    cursor: "pointer"
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={() => deleteExistingNode(selectedExistingNode)}
                  style={{ 
                    flex: 1,
                    padding: "3px", 
                    fontSize: 9,
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: 2,
                    cursor: "pointer"
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedExistingNode(null)}
                  style={{ 
                    flex: 1,
                    padding: "3px", 
                    fontSize: 9,
                    backgroundColor: "#666",
                    color: "white",
                    border: "none",
                    borderRadius: 2,
                    cursor: "pointer"
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Edit Controls */}
          {Object.keys(editableNodes).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, marginBottom: 4 }}>
                Modified: {Object.keys(editableNodes).filter(id => !editableNodes[id].deleted).length} | 
                Deleted: {Object.keys(editableNodes).filter(id => editableNodes[id].deleted).length}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={resetAllExistingNodes}
                  style={{ 
                    flex: 1,
                    padding: "4px", 
                    fontSize: 10,
                    backgroundColor: "#ff5722",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}
                >
                  Reset All
                </button>
                <button
                  onClick={exportUpdatedGraph}
                  style={{ 
                    flex: 1,
                    padding: "4px", 
                    fontSize: 10,
                    backgroundColor: "#4caf50",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}
                >
                  Export Updated Graph
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Node Creation Section */}
        <div style={{ borderTop: "1px solid #ddd", paddingTop: 12, marginTop: 12 }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: "bold" }}>Create New Nodes</h4>
          
          {/* Node Creation Mode Toggle */}
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
            <input 
              type="checkbox" 
              checked={nodeCreationMode} 
              onChange={e => setNodeCreationMode(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Click-to-Add Mode
          </label>

          {/* Manual Input Form */}
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Node ID"
              value={manualInput.id}
              onChange={e => setManualInput(prev => ({ ...prev, id: e.target.value }))}
              style={{ width: "100%", padding: "4px", marginBottom: 4, fontSize: 11 }}
            />
            <input
              type="number"
              placeholder="Latitude"
              step="0.000001"
              value={manualInput.lat}
              onChange={e => setManualInput(prev => ({ ...prev, lat: e.target.value }))}
              style={{ width: "48%", padding: "4px", marginRight: "2%", fontSize: 11 }}
            />
            <input
              type="number"
              placeholder="Longitude"
              step="0.000001"
              value={manualInput.lng}
              onChange={e => setManualInput(prev => ({ ...prev, lng: e.target.value }))}
              style={{ width: "48%", padding: "4px", marginLeft: "2%", fontSize: 11 }}
            />
            <button
              onClick={addNodeManually}
              style={{ 
                width: "100%", 
                padding: "6px", 
                marginTop: 4, 
                fontSize: 11,
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Add Node Manually
            </button>
          </div>

          {/* Node Management */}
          {Object.keys(customNodes).length > 0 && (
            <div>
              <div style={{ fontSize: 11, marginBottom: 4 }}>
                Custom Nodes: {Object.keys(customNodes).length}
              </div>
              <button
                onClick={exportCustomNodes}
                style={{ 
                  width: "100%", 
                  padding: "4px", 
                  fontSize: 10,
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  marginBottom: 4
                }}
              >
                Export Nodes
              </button>
            </div>
          )}

          {/* Selected Node Info */}
          {selectedNode && customNodes[selectedNode] && (
            <div style={{ 
              backgroundColor: "#f8f9fa", 
              padding: "6px", 
              borderRadius: 4, 
              fontSize: 10,
              marginTop: 8
            }}>
              <div><strong>Selected:</strong> {selectedNode}</div>
              <div>Lat: {customNodes[selectedNode].lat.toFixed(6)}</div>
              <div>Lng: {customNodes[selectedNode].lng.toFixed(6)}</div>
              <button
                onClick={() => deleteNode(selectedNode)}
                style={{ 
                  width: "100%", 
                  padding: "2px", 
                  fontSize: 10,
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: 2,
                  cursor: "pointer",
                  marginTop: 4
                }}
              >
                Delete Node
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
