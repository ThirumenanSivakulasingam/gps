// MapWithGeoSvg - Clean version with NodeEditor integration
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

/* ---------------- Bounds for the map ---------------- */
const BOUNDS = L.latLngBounds(
  [7.250, 80.590], // SW corner
  [7.256, 80.595]  // NE corner
);

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

      } catch (err) {
        console.error("Failed to load SVG overlay:", err);
      }
    })();

    return () => {
      cancelled = true;
      listeners.forEach(({ el, handler }) => {
        el.removeEventListener("click", handler);
      });
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
      }
    };
  }, [url, bounds, pane, onPick, map]);

  // Update opacity when prop changes
  useEffect(() => {
    if (overlayRef.current && typeof overlayRef.current.setOpacity === "function") {
      overlayRef.current.setOpacity(opacity);
    } else if (svgRef.current) {
      // fallback: set directly on the <svg> element
      svgRef.current.style.opacity = String(opacity);
    }
  }, [opacity]);

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
          
          return (
            <CircleMarker
              key={`graph-node-${id}`}
              center={[n.lat, n.lng]}
              radius={6}
              pathOptions={{
                color: isEntrance ? "green" : "red",
                fillOpacity: 0.9,
                weight: 1.5
              }}
              pane="routesPane"
            >
              {showGraphLabels && (
                <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent>
                  <div style={{ fontWeight: 600 }}>{id}</div>
                  <div style={{ fontSize: 11 }}>
                    {n.lat.toFixed(6)}, {n.lng.toFixed(6)}
                  </div>
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}

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
          <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
            <input 
              type="checkbox" 
              checked={showGraphLabels} 
              onChange={e => setShowGraphLabels(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show Graph Labels
          </label>
        )}
      </div>
    </div>
  );
}

