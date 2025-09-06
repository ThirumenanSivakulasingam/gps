// Coordinate Finder Component
// Click anywhere on the SVG map to get real GPS coordinates
import { useState, useEffect } from 'react';
import { CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

// Coordinate marker icon
const coordinateIcon = L.divIcon({
  className: "coordinate-marker",
  html: `<div style="width:12px;height:12px;border-radius:50%;
         background:#ff6b35; border:2px solid white; box-shadow:0 0 6px rgba(255,107,53,.8);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

export default function CoordinateFinder({ 
  isActive = false, 
  onCoordinateFound = null 
}) {
  const map = useMap();
  const [clickedCoordinates, setClickedCoordinates] = useState(null);
  const [coordinateHistory, setCoordinateHistory] = useState([]);

  // Handle map click
  const handleMapClick = (e) => {
    if (!isActive) return;
    
    const { lat, lng } = e.latlng;
    const coordinate = { lat, lng };
    
    setClickedCoordinates(coordinate);
    
    // Add to history
    const historyItem = {
      ...coordinate,
      timestamp: Date.now(),
      id: Date.now()
    };
    
    setCoordinateHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10
    
    console.log('📍 Coordinate found:', coordinate);
    
    // Notify parent component
    onCoordinateFound?.(coordinate);
  };

  // Add click event listener to map
  useEffect(() => {
    if (isActive) {
      map.on('click', handleMapClick);
      console.log('🎯 Coordinate Finder activated - click anywhere on the map');
    } else {
      map.off('click', handleMapClick);
    }

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isActive, map]);

  // Copy coordinate to clipboard
  const copyToClipboard = (coordinate) => {
    const text = `{ lat: ${coordinate.lat}, lng: ${coordinate.lng} }`;
    navigator.clipboard.writeText(text).then(() => {
      console.log('📋 Coordinate copied to clipboard:', text);
    }).catch(err => {
      console.error('Failed to copy coordinate:', err);
    });
  };

  // Export coordinates as JSON
  const exportCoordinates = () => {
    const data = {
      coordinates: coordinateHistory,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coordinates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear history
  const clearHistory = () => {
    setCoordinateHistory([]);
    setClickedCoordinates(null);
  };

  // Don't render if not active
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
        minWidth: '300px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Coordinate Finder</h3>
        
        {/* Status */}
        <div style={{ marginBottom: '15px', padding: '10px', background: '#d1ecf1', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', color: '#0c5460' }}>
            🎯 Click anywhere on the map to get coordinates
          </div>
          <div style={{ fontSize: '12px', marginTop: '4px', color: '#0c5460' }}>
            Active: {isActive ? 'Yes' : 'No'}
          </div>
        </div>

        {/* Current Coordinate */}
        {clickedCoordinates && (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#d4edda', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', color: '#155724', marginBottom: '8px' }}>
              📍 Latest Coordinate:
            </div>
            <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#155724', marginBottom: '8px' }}>
              {`{ lat: ${clickedCoordinates.lat.toFixed(6)}, lng: ${clickedCoordinates.lng.toFixed(6)} }`}
            </div>
            <button 
              onClick={() => copyToClipboard(clickedCoordinates)}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              📋 Copy
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ marginBottom: '15px' }}>
          <button 
            onClick={exportCoordinates}
            disabled={coordinateHistory.length === 0}
            style={{
              background: coordinateHistory.length === 0 ? '#6c757d' : '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: coordinateHistory.length === 0 ? 'not-allowed' : 'pointer',
              marginRight: '8px',
              fontSize: '12px'
            }}
          >
            💾 Export JSON
          </button>
          
          <button 
            onClick={clearHistory}
            disabled={coordinateHistory.length === 0}
            style={{
              background: coordinateHistory.length === 0 ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: coordinateHistory.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            🗑️ Clear History
          </button>
        </div>

        {/* Coordinate History */}
        {coordinateHistory.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Coordinate History:</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
              {coordinateHistory.map((coord, index) => (
                <div 
                  key={coord.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #eee',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    #{index + 1}
                  </div>
                  <div style={{ fontFamily: 'monospace', color: '#333', marginBottom: '4px', fontSize: '11px' }}>
                    {`{ lat: ${coord.lat.toFixed(6)}, lng: ${coord.lng.toFixed(6)} }`}
                  </div>
                  <div style={{ color: '#666', fontSize: '10px' }}>
                    {new Date(coord.timestamp).toLocaleTimeString()}
                  </div>
                  <button 
                    onClick={() => copyToClipboard(coord)}
                    style={{
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      marginTop: '4px'
                    }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div style={{ marginTop: '15px', fontSize: '11px', color: '#666' }}>
          <strong>Instructions:</strong>
          <br />1. Click anywhere on the map to get GPS coordinates
          <br />2. Copy coordinates to clipboard
          <br />3. Export all coordinates as JSON
          <br />4. Use these coordinates in your code
        </div>
      </div>

      {/* Render coordinate markers on map */}
      {coordinateHistory.map((coord, index) => (
        <CircleMarker
          key={coord.id}
          center={[coord.lat, coord.lng]}
          radius={3}
          pathOptions={{
            color: '#ff6b35',
            fillColor: '#ff6b35',
            fillOpacity: 0.8,
            weight: 2
          }}
        />
      ))}
    </div>
  );
}
