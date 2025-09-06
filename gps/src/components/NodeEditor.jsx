// Node Editor Component - Can be integrated into main app
import { useState, useEffect, useRef } from 'react';
import { CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { exportUpdatedGraphJS } from '../utils/convertEditedData';
import { nodes as graphNodes } from '../routing/graph';

// Node Editor Component
export default function NodeEditor({ 
  isActive = false, 
  onNodesUpdate = null,
  onPathsUpdate = null 
}) {
  const [editableNodes, setEditableNodes] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [paths, setPaths] = useState([]);
  const [showPaths, setShowPaths] = useState(true);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [pathCreationMode, setPathCreationMode] = useState(false);
  const [pathStartNode, setPathStartNode] = useState(null);
  const [curvedPathMode, setCurvedPathMode] = useState(false);
  const [pathControlPoints, setPathControlPoints] = useState([]);
  const [showExistingNodes, setShowExistingNodes] = useState(false);

  // Initialize with nodes from graph.js (only when explicitly requested)
  useEffect(() => {
    if (isActive && showExistingNodes) {
      const initialNodes = {};
      Object.entries(graphNodes).forEach(([id, node]) => {
        // Determine node type based on ID
        let type = 'node';
        if (id.toLowerCase().includes('entry')) type = 'entry';
        else if (id.toLowerCase().includes('exit')) type = 'exit';
        else if (id === 'ENTRY') type = 'entry';
        
        initialNodes[id] = {
          ...node,
          type: type,
          original: true // Mark as original node from graph
        };
      });
      setEditableNodes(initialNodes);
    } else if (isActive && !showExistingNodes) {
      // Clear existing nodes if toggle is off
      setEditableNodes({});
    }
  }, [isActive, showExistingNodes]);

  // Handle node click
  const handleNodeClick = (nodeId) => {
    if (pathCreationMode) {
      if (!pathStartNode) {
        // First node selected for path creation
        setPathStartNode(nodeId);
        setSelectedNode(nodeId);
      } else if (pathStartNode !== nodeId) {
        // Second node selected - create path
        createPath(pathStartNode, nodeId);
        setPathStartNode(null);
        setSelectedNode(null);
      }
    } else {
      setSelectedNode(nodeId);
    }
  };

  // Handle node drag
  const handleNodeDrag = (nodeId, newLat, newLng) => {
    setEditableNodes(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        lat: newLat,
        lng: newLng
      }
    }));
    
    // Notify parent component of changes
    if (onNodesUpdate) {
      onNodesUpdate(editableNodes);
    }
  };

  // Create a path between two nodes
  const createPath = (fromNodeId, toNodeId) => {
    const fromNode = editableNodes[fromNodeId];
    const toNode = editableNodes[toNodeId];
    
    if (!fromNode || !toNode) return;
    
    const distance = calculateDistance(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
    const pathId = `${fromNodeId}-${toNodeId}`;
    
    // Check if path already exists
    const existingPath = paths.find(p => 
      (p.from === fromNodeId && p.to === toNodeId) || 
      (p.from === toNodeId && p.to === fromNodeId)
    );
    
    if (existingPath) {
      console.log('Path already exists between these nodes');
      return;
    }
    
    const newPath = {
      id: pathId,
      from: fromNodeId,
      to: toNodeId,
      positions: [[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]],
      distance: distance,
      custom: true // Mark as custom path
    };
    
    setPaths(prev => [...prev, newPath]);
    
    // Notify parent component of path changes
    if (onPathsUpdate) {
      onPathsUpdate([...paths, newPath]);
    }
  };

  // Add new node at clicked position
  const handleMapClick = (e) => {
    if (!isEditing && !curvedPathMode) return;
    
    const { lat, lng } = e.latlng;
    
    if (curvedPathMode) {
      // Add control point for curved path
      setPathControlPoints(prev => [...prev, { lat, lng }]);
      return;
    }
    
    const newNodeId = `node${nodeIdCounter}`;
    
    setEditableNodes(prev => ({
      ...prev,
      [newNodeId]: {
        lat: lat,
        lng: lng,
        type: 'node',
        original: false // Mark as new node
      }
    }));
    
    setNodeIdCounter(prev => prev + 1);
  };

  // Create curved path with control points
  const createCurvedPath = (fromNodeId, toNodeId, controlPoints) => {
    const fromNode = editableNodes[fromNodeId];
    const toNode = editableNodes[toNodeId];
    
    if (!fromNode || !toNode) return;
    
    // Create smooth curve using control points
    const curvePoints = generateCurvePoints(
      [fromNode.lat, fromNode.lng],
      [toNode.lat, toNode.lng],
      controlPoints.map(cp => [cp.lat, cp.lng])
    );
    
    const distance = calculatePathDistance(curvePoints);
    const pathId = `curved-${fromNodeId}-${toNodeId}-${Date.now()}`;
    
    const newPath = {
      id: pathId,
      from: fromNodeId,
      to: toNodeId,
      positions: curvePoints,
      distance: distance,
      custom: true,
      curved: true,
      controlPoints: controlPoints
    };
    
    setPaths(prev => [...prev, newPath]);
    
    // Notify parent component of path changes
    if (onPathsUpdate) {
      onPathsUpdate([...paths, newPath]);
    }
  };

  // Generate smooth curve points using quadratic Bezier curves
  const generateCurvePoints = (start, end, controlPoints) => {
    const points = [start];
    
    if (controlPoints.length === 0) {
      // No control points, straight line
      return [start, end];
    }
    
    // Create smooth curve through control points
    const allPoints = [start, ...controlPoints, end];
    
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      
      // Add intermediate points for smooth curve
      for (let t = 0.1; t < 1; t += 0.1) {
        const lat = p1[0] + (p2[0] - p1[0]) * t;
        const lng = p1[1] + (p2[1] - p1[1]) * t;
        points.push([lat, lng]);
      }
    }
    
    points.push(end);
    return points;
  };

  // Calculate total distance of a path
  const calculatePathDistance = (points) => {
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += calculateDistance(
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1]
      );
    }
    return totalDistance;
  };

  // Auto path generation removed - only manual edge creation is supported

  // Calculate distance between two points
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Export data as JSON
  const exportData = () => {
    const data = {
      nodes: editableNodes,
      paths: paths,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited_nodes_and_paths.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export updated graph.js
  const exportGraphJS = () => {
    const data = {
      nodes: editableNodes,
      paths: paths,
      timestamp: new Date().toISOString()
    };
    
    exportUpdatedGraphJS(data);
  };

  // Clear all nodes
  const clearAll = () => {
    setEditableNodes({});
    setPaths([]);
    setSelectedNode(null);
    setNodeIdCounter(1);
  };

  // Clear all paths (since we only have manual paths now)
  const clearAllPaths = () => {
    setPaths([]);
    
    // Notify parent component of path changes
    if (onPathsUpdate) {
      onPathsUpdate([]);
    }
  };

  // Don't render anything if not active
  if (!isActive) return null;

  return (
    <div>
      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        minWidth: '250px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Node Editor</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            style={{
              background: isEditing ? '#f44336' : '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            {isEditing ? 'Stop Editing' : 'Start Editing'}
          </button>
          
          <button 
            onClick={() => setShowExistingNodes(!showExistingNodes)}
            style={{
              background: showExistingNodes ? '#f44336' : '#2196F3',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showExistingNodes ? 'Hide Existing Nodes' : 'Show Existing Nodes'}
          </button>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={() => setPathCreationMode(!pathCreationMode)}
            style={{
              background: pathCreationMode ? '#f44336' : '#FF9800',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            {pathCreationMode ? 'Stop Straight Paths' : 'Create Straight Paths'}
          </button>
          
          <button 
            onClick={() => setCurvedPathMode(!curvedPathMode)}
            style={{
              background: curvedPathMode ? '#f44336' : '#9C27B0',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {curvedPathMode ? 'Stop Curved Paths' : 'Create Curved Paths'}
          </button>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={() => setShowPaths(!showPaths)}
            style={{
              background: showPaths ? '#f44336' : '#2196F3',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            {showPaths ? 'Hide' : 'Show'} Paths
          </button>
          
          <button 
            onClick={clearAllPaths}
            style={{
              background: '#FF5722',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear All Paths
          </button>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={exportData}
            style={{
              background: '#FF9800',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Export JSON
          </button>
          
          <button 
            onClick={exportGraphJS}
            style={{
              background: '#9C27B0',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Export Graph.js
          </button>
          
          
          <button 
            onClick={clearAll}
            style={{
              background: '#f44336',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear All
          </button>
        </div>
        
        <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          <div>Nodes: {Object.keys(editableNodes).length}</div>
          <div>Paths: {paths.length} (All Manual)</div>
          <div>Editing: {isEditing ? 'ON' : 'OFF'}</div>
          <div>Existing Nodes: {showExistingNodes ? 'ON' : 'OFF'}</div>
          <div>Straight Paths: {pathCreationMode ? 'ON' : 'OFF'}</div>
          <div>Curved Paths: {curvedPathMode ? 'ON' : 'OFF'}</div>
          {pathCreationMode && pathStartNode && (
            <div style={{ color: '#FF9800', fontWeight: 'bold' }}>
              Click another node to create straight path from {pathStartNode}
            </div>
          )}
          {showExistingNodes && Object.keys(editableNodes).length > 50 && (
            <div style={{ color: '#f44336', fontWeight: 'bold' }}>
              ⚠️ {Object.keys(editableNodes).length} nodes loaded - may slow down performance
            </div>
          )}
          {curvedPathMode && pathControlPoints.length > 0 && (
            <div style={{ color: '#9C27B0', fontWeight: 'bold' }}>
              Control points: {pathControlPoints.length} - Click nodes to create curved path
            </div>
          )}
          <div style={{ marginTop: '5px' }}>
            <strong>Instructions:</strong>
            <br />• <strong>Show Existing:</strong> Toggle to load all 75+ nodes from graph.js
            <br />• <strong>Adjust Points:</strong> Click "Start Editing" then drag nodes to move them
            <br />• <strong>Add Points:</strong> Click on map to add new nodes
            <br />• <strong>Straight Paths:</strong> Click "Create Straight Paths" then click two nodes
            <br />• <strong>Curved Paths:</strong> Click "Create Curved Paths" then click control points, then two nodes
            <br />• <strong>Manual Only:</strong> All edges must be created manually by joining two nodes
          </div>
        </div>
      </div>

      {Object.entries(editableNodes).map(([nodeId, node]) => (
        <DraggableNode
          key={nodeId}
          nodeId={nodeId}
          node={node}
          isSelected={selectedNode === nodeId}
          isPathStart={pathStartNode === nodeId}
          pathCreationMode={pathCreationMode}
          onNodeClick={handleNodeClick}
          onNodeDrag={handleNodeDrag}
        />
      ))}
      
      {/* Render paths */}
      {showPaths && paths.map((path) => (
        <Polyline
          key={path.id}
          positions={path.positions}
          pathOptions={{
            color: path.curved ? '#9C27B0' : '#FF9800', // Purple for curved, orange for manual
            weight: path.curved ? 5 : 4,
            opacity: 0.8,
            dashArray: path.curved ? '10, 5' : '5, 5' // Different dash patterns
          }}
        />
      ))}
      
      {/* Render control points for curved paths */}
      {curvedPathMode && pathControlPoints.map((point, index) => (
        <CircleMarker
          key={`control-${index}`}
          center={[point.lat, point.lng]}
          radius={4}
          pathOptions={{
            color: '#9C27B0',
            fillColor: '#9C27B0',
            fillOpacity: 0.8,
            weight: 2
          }}
        />
      ))}
    </div>
  );
}

// Draggable Node Component
function DraggableNode({ nodeId, node, isSelected, isPathStart, pathCreationMode, onNodeClick, onNodeDrag }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (markerRef.current) {
      const marker = markerRef.current;
      
      // Add drag event listener
      marker.on('drag', (e) => {
        const { lat, lng } = e.target.getLatLng();
        onNodeDrag(nodeId, lat, lng);
      });
      
      // Add click event listener
      marker.on('click', (e) => {
        e.originalEvent.stopPropagation(); // Prevent map click
        onNodeClick(nodeId);
      });
    }
  }, [nodeId, onNodeClick, onNodeDrag]);

  const getNodeColor = (type) => {
    if (isPathStart) return '#FF9800'; // Orange for path start
    if (isSelected) return '#FFD700'; // Gold for selected
    switch (type) {
      case 'entry': return '#4CAF50'; // Green for entry
      case 'exit': return '#f44336'; // Red for exit
      default: return '#2196F3'; // Blue for regular nodes
    }
  };

  const getNodeRadius = (type) => {
    if (isPathStart || isSelected) return 10; // Larger for active nodes
    return type === 'entry' || type === 'exit' ? 8 : 6;
  };

  const getNodeStyle = () => {
    const baseStyle = {
      color: getNodeColor(node.type),
      fillColor: getNodeColor(node.type),
      fillOpacity: 0.8,
      weight: (isSelected || isPathStart) ? 3 : 2
    };

    // Add pulsing effect for path creation mode
    if (pathCreationMode && !isPathStart) {
      baseStyle.fillOpacity = 0.6;
      baseStyle.weight = 1;
    }

    return baseStyle;
  };

  return (
    <CircleMarker
      ref={markerRef}
      center={[node.lat, node.lng]}
      radius={getNodeRadius(node.type)}
      pathOptions={getNodeStyle()}
      draggable={true}
    />
  );
}
