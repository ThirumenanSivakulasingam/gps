import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Pane, useMap, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import LocationWatcher from './LocationWatcher';
import LocationMapper from './LocationMapper';
import NodeEditor from './NodeEditor';
import CoordinateFinder from './CoordinateFinder';
import PathTester from './PathTester';
import EnhancedNavigator from './EnhancedNavigator';
import './SmartMobileUI.css';

// Import existing components and utilities
import { predefinedPaths } from '../utils/coordinateMapping';
import { dijkstra } from '../routing/dijkstra';
import { nearestNode } from '../routing/astar';
import { nodes, edges, buildingEntrance } from '../routing/graph';

// SVG Map dimensions and bounds
const SVG_VIEWBOX = { width: 462.6, height: 549.2 };
const SVG_ASPECT_RATIO = SVG_VIEWBOX.width / SVG_VIEWBOX.height; // ~0.84

// Campus bounds for the map
const TOP_LEFT = [7.255565, 80.590510];
const BOTTOM_RIGHT = [7.251971, 80.593542];
const SW = [BOTTOM_RIGHT[0], TOP_LEFT[1]];
const NE = [TOP_LEFT[0], BOTTOM_RIGHT[1]];
const BOUNDS = L.latLngBounds(SW, NE);

// SVG Overlay Component
function SvgOverlayLoader({ url, bounds, pane = "svgPane", opacity = 1, onPick, userPos }) {
  const map = useMap();
  const overlayRef = useRef(null);
  const svgRef = useRef(null);

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
        if (bad) throw new Error("Invalid SVG");

        const svg = doc.documentElement;
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.opacity = opacity;

        if (overlayRef.current) {
          map.removeLayer(overlayRef.current);
        }

        const overlay = L.svgOverlay(svg, bounds, { pane });
        overlayRef.current = overlay;
        map.addLayer(overlay);

        svgRef.current = svg;

        // Add click listeners to SVG elements
        const clickableElements = svg.querySelectorAll('[data-building-id]');
        listeners = Array.from(clickableElements).map(el => {
          const handler = (e) => {
            e.stopPropagation();
            const buildingId = el.getAttribute('data-building-id');
            onPick?.(buildingId);
          };
          el.addEventListener('click', handler);
          return { el, handler };
        });

      } catch (err) {
        console.error("SVG overlay error:", err);
      }
    })();

    return () => {
      cancelled = true;
      listeners.forEach(({ el, handler }) => el.removeEventListener('click', handler));
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
      }
    };
  }, [url, bounds, pane, opacity, onPick, map]);

  useEffect(() => {
    if (svgRef.current) {
      svgRef.current.style.opacity = opacity;
    }
  }, [opacity]);

  return null;
}

// Mobile Navigation Drawer
function MobileDrawer({ isOpen, onClose, children, title }) {
  return (
    <div className={`mobile-drawer ${isOpen ? 'open' : ''}`}>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <div className="drawer-content">
        <div className="drawer-header">
          <h3>{title}</h3>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// Smart Control Panel
function SmartControlPanel({ 
  activeModules, 
  onToggleModule, 
  onOpenDrawer,
  userPosition,
  isMobile 
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const modules = [
    { id: 'nodeEditor', name: 'Node Editor', icon: '📝', description: 'Edit nodes and paths' },
    { id: 'coordinateFinder', name: 'Coordinate Finder', icon: '📍', description: 'Find coordinates' },
    { id: 'locationMapper', name: 'Location Mapper', icon: '🗺️', description: 'Map real to SVG coordinates' },
    { id: 'pathTester', name: 'Path Tester', icon: '🧪', description: 'Test path navigation' },
    { id: 'enhancedNavigator', name: 'Enhanced Navigator', icon: '🧭', description: 'Google Maps-like navigation' }
  ];

  if (isMobile) {
    return (
      <div className="mobile-control-panel">
        <button 
          className="control-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="control-icon">⚙️</span>
          <span className="control-text">Controls</span>
        </button>
        
        {isExpanded && (
          <div className="mobile-controls">
            {modules.map(module => (
              <button
                key={module.id}
                className={`control-button ${activeModules[module.id] ? 'active' : ''}`}
                onClick={() => onToggleModule(module.id)}
                title={module.description}
              >
                <span className="button-icon">{module.icon}</span>
                <span className="button-text">{module.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="desktop-control-panel">
      <div className="control-header">
        <h3>GPS Controls</h3>
        <div className="location-status">
          {userPosition ? (
            <span className="status-indicator online">📍 Online</span>
          ) : (
            <span className="status-indicator offline">📍 Offline</span>
          )}
        </div>
      </div>
      
      <div className="control-modules">
        {modules.map(module => (
          <label key={module.id} className="control-module">
            <input
              type="checkbox"
              checked={activeModules[module.id] || false}
              onChange={() => onToggleModule(module.id)}
            />
            <div className="module-info">
              <span className="module-icon">{module.icon}</span>
              <div className="module-details">
                <span className="module-name">{module.name}</span>
                <span className="module-description">{module.description}</span>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// Main Smart Mobile UI Component
export default function SmartMobileUI() {
  const [userPos, setUserPos] = useState(null);
  const [route, setRoute] = useState([]);
  const [svgOpacity, setSvgOpacity] = useState(1.0);
  const [activeModules, setActiveModules] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [openDrawer, setOpenDrawer] = useState(null);
  const [mapContainerRef, setMapContainerRef] = useState(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate viewport dimensions based on SVG aspect ratio
  const getViewportDimensions = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    if (isMobile) {
      // On mobile, use full screen with proper aspect ratio
      const maxWidth = screenWidth - 20; // 10px margin on each side
      const maxHeight = screenHeight - 100; // Leave space for controls
      
      let width = maxWidth;
      let height = width / SVG_ASPECT_RATIO;
      
      if (height > maxHeight) {
        height = maxHeight;
        width = height * SVG_ASPECT_RATIO;
      }
      
      return { width, height };
    } else {
      // On desktop, use a fixed size that maintains aspect ratio
      const baseSize = 600;
      return {
        width: baseSize,
        height: baseSize / SVG_ASPECT_RATIO
      };
    }
  };

  const viewportDimensions = getViewportDimensions();

  const toggleModule = (moduleId) => {
    setActiveModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const handleBuildingPick = (buildingId) => {
    const destNode = buildingEntrance[buildingId];
    if (!destNode) {
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

  const adjustOpacity = (value) => {
    const v = Math.max(0, Math.min(1, value));
    setSvgOpacity(v);
  };

  return (
    <div className="smart-mobile-ui">
      {/* Mobile Header */}
      {isMobile && (
        <div className="mobile-header">
          <h1>GPS Navigation</h1>
          <div className="header-controls">
            <button 
              className="header-button"
              onClick={() => setOpenDrawer('settings')}
            >
              ⚙️
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="desktop-sidebar">
            <SmartControlPanel
              activeModules={activeModules}
              onToggleModule={toggleModule}
              userPosition={userPos}
              isMobile={false}
            />
          </div>
        )}

        {/* Map Container with SVG-matched viewport */}
        <div className="map-viewport-container">
          <div 
            className="map-viewport"
            style={{
              width: `${viewportDimensions.width}px`,
              height: `${viewportDimensions.height}px`,
              aspectRatio: SVG_ASPECT_RATIO
            }}
          >
            <MapContainer
              center={BOUNDS.getCenter()}
              zoom={17}
              style={{ height: '100%', width: '100%' }}
              bounds={BOUNDS}
              boundsOptions={{ padding: [10, 10] }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={22}
              />

              <Pane name="svgPane" style={{ zIndex: 200 }} />
              <Pane name="routePane" style={{ zIndex: 300 }} />
              <Pane name="markerPane" style={{ zIndex: 400 }} />

              {/* SVG Overlay */}
              <SvgOverlayLoader
                url={import.meta.env.BASE_URL + "map.svg"}
                bounds={BOUNDS}
                pane="svgPane"
                opacity={svgOpacity}
                onPick={handleBuildingPick}
                userPos={userPos}
              />

              {/* Active Components */}
              {activeModules.locationMapper ? (
                <LocationMapper
                  isActive={activeModules.locationMapper}
                  userPosition={userPos}
                />
              ) : (
                <LocationWatcher
                  isActive={!activeModules.locationMapper}
                  onPositionUpdate={setUserPos}
                />
              )}

              {activeModules.nodeEditor && (
                <NodeEditor
                  isActive={activeModules.nodeEditor}
                  showExistingNodes={true}
                />
              )}

              {activeModules.coordinateFinder && (
                <CoordinateFinder
                  isActive={activeModules.coordinateFinder}
                  onCoordinateFound={(coordinate) => {
                    console.log('📍 Coordinate found:', coordinate);
                  }}
                />
              )}

              {activeModules.pathTester && (
                <PathTester
                  isActive={activeModules.pathTester}
                  onTestProgress={(progress) => {
                    console.log('🧪 Test progress:', progress);
                  }}
                />
              )}

              {/* Route Display */}
              {route.length > 0 && (
                <Polyline
                  positions={route}
                  color="#2196F3"
                  weight={4}
                  opacity={0.8}
                  pane="routePane"
                />
              )}

              {/* Predefined Path */}
              {activeModules.showPredefinedPath && predefinedPaths.mainPath && (
                <Polyline
                  positions={predefinedPaths.mainPath}
                  color="#FF9800"
                  weight={3}
                  opacity={0.7}
                  dashArray="10, 5"
                  pane="routePane"
                />
              )}
            </MapContainer>
          </div>

          {/* Mobile Controls Overlay */}
          {isMobile && (
            <div className="mobile-controls-overlay">
              <SmartControlPanel
                activeModules={activeModules}
                onToggleModule={toggleModule}
                userPosition={userPos}
                isMobile={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawers */}
      <MobileDrawer
        isOpen={openDrawer === 'settings'}
        onClose={() => setOpenDrawer(null)}
        title="Settings"
      >
        <div className="settings-content">
          <div className="setting-group">
            <label>SVG Opacity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={svgOpacity}
              onChange={(e) => adjustOpacity(parseFloat(e.target.value))}
            />
            <span>{Math.round(svgOpacity * 100)}%</span>
          </div>
          
          <div className="setting-group">
            <h4>Active Modules</h4>
            {Object.entries(activeModules).map(([moduleId, isActive]) => (
              <label key={moduleId} className="setting-item">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => toggleModule(moduleId)}
                />
                {moduleId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </label>
            ))}
          </div>
        </div>
      </MobileDrawer>

      {/* Enhanced Navigator (Full Screen Mode) */}
      {activeModules.enhancedNavigator && (
        <div className="enhanced-navigator-overlay">
          <EnhancedNavigator />
        </div>
      )}
    </div>
  );
}
