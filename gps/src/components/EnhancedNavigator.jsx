import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { computeRoute } from '../routing/computeRoute';
import { nodes, edges, buildingEntrance, buildingExit } from '../routing/graph';
import { dijkstra } from '../routing/dijkstra';

// Custom icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const navigationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Navigation UI Component
function NavigationUI({ 
  isNavigating, 
  currentRoute, 
  userPosition, 
  nextTurn, 
  distanceToDestination, 
  estimatedTime,
  onStartNavigation,
  onStopNavigation,
  onRecalculateRoute
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isNavigating && !currentRoute) return null;

  return (
    <div className={`navigation-ui ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="navigation-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="nav-status">
          {isNavigating ? (
            <span className="status-text">🔄 Navigating</span>
          ) : (
            <span className="status-text">📍 Route Ready</span>
          )}
        </div>
        <div className="nav-toggle">▼</div>
      </div>

      {isExpanded && (
        <div className="navigation-details">
          {nextTurn && (
            <div className="next-turn">
              <h3>Next Turn</h3>
              <p>{nextTurn.instruction}</p>
              <span className="distance">{nextTurn.distance}m</span>
            </div>
          )}

          <div className="route-info">
            <div className="info-item">
              <span className="label">Distance:</span>
              <span className="value">{distanceToDestination}m</span>
            </div>
            <div className="info-item">
              <span className="label">Time:</span>
              <span className="value">{estimatedTime}</span>
            </div>
          </div>

          <div className="navigation-controls">
            {!isNavigating ? (
              <button className="nav-button start" onClick={onStartNavigation}>
                Start Navigation
              </button>
            ) : (
              <button className="nav-button stop" onClick={onStopNavigation}>
                Stop Navigation
              </button>
            )}
            <button className="nav-button recalculate" onClick={onRecalculateRoute}>
              Recalculate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Turn-by-turn directions component
function TurnByTurnDirections({ route, currentStep, userPosition }) {
  if (!route || !route.polyline) return null;

  const directions = generateTurnByTurnDirections(route.polyline, route.pathNodeIds);
  
  return (
    <div className="turn-by-turn">
      <h3>Directions</h3>
      <div className="directions-list">
        {directions.map((direction, index) => (
          <div 
            key={index} 
            className={`direction-step ${index === currentStep ? 'current' : ''}`}
          >
            <div className="step-number">{index + 1}</div>
            <div className="step-content">
              <p>{direction.instruction}</p>
              <span className="step-distance">{direction.distance}m</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Generate turn-by-turn directions
function generateTurnByTurnDirections(polyline, pathNodeIds) {
  const directions = [];
  
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const currentNode = pathNodeIds[i];
    const nextNode = pathNodeIds[i + 1];
    
    if (i === 0) {
      directions.push({
        instruction: "Start navigation",
        distance: 0,
        nodeId: currentNode
      });
    } else {
      const distance = calculateDistance(
        nodes[currentNode].lat, nodes[currentNode].lng,
        nodes[nextNode].lat, nodes[nextNode].lng
      );
      
      let instruction = "Continue straight";
      
      // Simple turn detection based on angle changes
      if (i > 0) {
        const prevNode = pathNodeIds[i - 1];
        const angle = calculateBearing(
          nodes[prevNode], nodes[currentNode], nodes[nextNode]
        );
        
        if (angle > 45 && angle < 135) {
          instruction = "Turn right";
        } else if (angle > 225 && angle < 315) {
          instruction = "Turn left";
        } else if (angle > 135 && angle < 225) {
          instruction = "Turn around";
        }
      }
      
      directions.push({
        instruction,
        distance: Math.round(distance),
        nodeId: nextNode
      });
    }
  }
  
  directions.push({
    instruction: "You have arrived at your destination",
    distance: 0,
    nodeId: pathNodeIds[pathNodeIds.length - 1]
  });
  
  return directions;
}

// Calculate bearing between three points
function calculateBearing(point1, point2, point3) {
  const bearing1 = getBearing(point1, point2);
  const bearing2 = getBearing(point2, point3);
  let angle = bearing2 - bearing1;
  
  if (angle < 0) angle += 360;
  if (angle > 360) angle -= 360;
  
  return angle;
}

// Get bearing between two points
function getBearing(point1, point2) {
  const lat1 = point1.lat * Math.PI / 180;
  const lat2 = point2.lat * Math.PI / 180;
  const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;
  
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

// Calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Route layer component
function RouteLayer({ route, userPosition, isNavigating }) {
  if (!route || !route.polyline) return null;

  return (
    <>
      <Polyline 
        positions={route.polyline} 
        color={isNavigating ? "#4CAF50" : "#2196F3"}
        weight={isNavigating ? 6 : 4}
        opacity={0.8}
      />
      
      {/* Mark route waypoints */}
      {route.polyline.map((point, index) => (
        <Marker 
          key={index} 
          position={point}
          icon={navigationIcon}
        >
          <Popup>
            <div>
              <strong>Waypoint {index + 1}</strong>
              <br />
              {route.pathNodeIds && route.pathNodeIds[index] && (
                <span>Node: {route.pathNodeIds[index]}</span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// Location watcher component
function LocationWatcher({ onPositionUpdate, onLocationError }) {
  const [position, setPosition] = useState(null);
  const watchId = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      onLocationError?.("Geolocation is not supported by this browser.");
      return;
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    };

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setPosition(newPosition);
        onPositionUpdate?.(newPosition);
      },
      (error) => {
        console.error("Geolocation error:", error);
        onLocationError?.(error.message);
      },
      options
    );

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [onPositionUpdate, onLocationError]);

  return position ? (
    <Marker position={[position.lat, position.lng]} icon={userIcon}>
      <Popup>
        <div>
          <strong>Your Location</strong>
          <br />
          Accuracy: {Math.round(position.accuracy)}m
        </div>
      </Popup>
    </Marker>
  ) : null;
}

// Main Enhanced Navigator Component
export default function EnhancedNavigator() {
  const [userPosition, setUserPosition] = useState(null);
  const [destination, setDestination] = useState(null);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [nextTurn, setNextTurn] = useState(null);
  const [distanceToDestination, setDistanceToDestination] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState("0 min");
  const [showDirections, setShowDirections] = useState(false);
  const [availableBuildings, setAvailableBuildings] = useState([]);
  const mapRef = useRef(null);

  // Initialize available buildings
  useEffect(() => {
    const buildings = Object.keys(buildingEntrance).map(buildingId => ({
      id: buildingId,
      name: buildingId.replace(/_/g, ' '),
      entranceNode: buildingEntrance[buildingId]
    }));
    setAvailableBuildings(buildings);
  }, []);

  // Calculate route when destination changes
  useEffect(() => {
    if (userPosition && destination) {
      calculateRoute();
    }
  }, [userPosition, destination]);

  // Navigation logic
  useEffect(() => {
    if (!isNavigating || !currentRoute || !userPosition) return;

    const interval = setInterval(() => {
      updateNavigation();
    }, 1000);

    return () => clearInterval(interval);
  }, [isNavigating, currentRoute, userPosition]);

  const calculateRoute = useCallback(() => {
    if (!userPosition || !destination) return;

    try {
      const route = computeRoute({
        userCoord: userPosition,
        destBuildingId: destination.id
      });

      if (route.ok) {
        setCurrentRoute(route);
        setCurrentStep(0);
        updateNavigationInfo(route, 0);
        
        // Center map on route
        if (mapRef.current && route.polyline.length > 0) {
          const bounds = L.latLngBounds(route.polyline);
          mapRef.current.fitBounds(bounds, { padding: [20, 20] });
        }
      } else {
        console.error("Route calculation failed:", route.error);
        alert(`Route calculation failed: ${route.error}`);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      alert("Error calculating route. Please try again.");
    }
  }, [userPosition, destination]);

  const updateNavigation = useCallback(() => {
    if (!currentRoute || !userPosition) return;

    // Find closest point on route
    let closestStep = 0;
    let minDistance = Infinity;

    currentRoute.polyline.forEach((point, index) => {
      const distance = calculateDistance(
        userPosition.lat, userPosition.lng,
        point[0], point[1]
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestStep = index;
      }
    });

    setCurrentStep(closestStep);
    updateNavigationInfo(currentRoute, closestStep);

    // Check if arrived at destination
    if (closestStep >= currentRoute.polyline.length - 1 && minDistance < 10) {
      setIsNavigating(false);
      alert("You have arrived at your destination!");
    }
  }, [currentRoute, userPosition]);

  const updateNavigationInfo = (route, step) => {
    if (!route || step >= route.polyline.length) return;

    // Calculate distance to destination
    let totalDistance = 0;
    for (let i = step; i < route.polyline.length - 1; i++) {
      totalDistance += calculateDistance(
        route.polyline[i][0], route.polyline[i][1],
        route.polyline[i + 1][0], route.polyline[i + 1][1]
      );
    }
    setDistanceToDestination(Math.round(totalDistance));

    // Estimate time (assuming 1.4 m/s walking speed)
    const estimatedMinutes = Math.round(totalDistance / 1.4 / 60);
    setEstimatedTime(`${estimatedMinutes} min`);

    // Get next turn instruction
    if (step < route.polyline.length - 1) {
      const directions = generateTurnByTurnDirections(route.polyline, route.pathNodeIds);
      const nextDirection = directions[step + 1];
      if (nextDirection) {
        setNextTurn({
          instruction: nextDirection.instruction,
          distance: nextDirection.distance
        });
      }
    }
  };

  const handleStartNavigation = () => {
    if (!currentRoute) {
      alert("Please select a destination first.");
      return;
    }
    setIsNavigating(true);
    setShowDirections(true);
  };

  const handleStopNavigation = () => {
    setIsNavigating(false);
    setShowDirections(false);
  };

  const handleRecalculateRoute = () => {
    calculateRoute();
  };

  const handleDestinationSelect = (building) => {
    setDestination(building);
    setCurrentRoute(null);
    setIsNavigating(false);
    setShowDirections(false);
  };

  const handleLocationError = (error) => {
    console.error("Location error:", error);
    alert(`Location error: ${error}`);
  };

  return (
    <div className="enhanced-navigator">
      <div className="navigator-controls">
        <div className="destination-selector">
          <label>Select Destination:</label>
          <select 
            value={destination?.id || ''} 
            onChange={(e) => {
              const building = availableBuildings.find(b => b.id === e.target.value);
              if (building) handleDestinationSelect(building);
            }}
          >
            <option value="">Choose a building...</option>
            {availableBuildings.map(building => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>

        <div className="navigation-toggle">
          <button 
            onClick={() => setShowDirections(!showDirections)}
            disabled={!currentRoute}
          >
            {showDirections ? 'Hide' : 'Show'} Directions
          </button>
        </div>
      </div>

      <div className="map-container">
        <MapContainer
          center={[7.2539, 80.5918]}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <LocationWatcher 
            onPositionUpdate={setUserPosition}
            onLocationError={handleLocationError}
          />

          {destination && (
            <Marker 
              position={[nodes[destination.entranceNode].lat, nodes[destination.entranceNode].lng]}
              icon={destinationIcon}
            >
              <Popup>
                <div>
                  <strong>{destination.name}</strong>
                  <br />
                  <span>Destination</span>
                </div>
              </Popup>
            </Marker>
          )}

          <RouteLayer 
            route={currentRoute}
            userPosition={userPosition}
            isNavigating={isNavigating}
          />
        </MapContainer>

        <NavigationUI
          isNavigating={isNavigating}
          currentRoute={currentRoute}
          userPosition={userPosition}
          nextTurn={nextTurn}
          distanceToDestination={distanceToDestination}
          estimatedTime={estimatedTime}
          onStartNavigation={handleStartNavigation}
          onStopNavigation={handleStopNavigation}
          onRecalculateRoute={handleRecalculateRoute}
        />

        {showDirections && currentRoute && (
          <div className="directions-panel">
            <TurnByTurnDirections 
              route={currentRoute}
              currentStep={currentStep}
              userPosition={userPosition}
            />
          </div>
        )}
      </div>
    </div>
  );
}
