// Location Mapper Component
// Maps real GPS coordinates to SVG reference points
import { useEffect, useState, useRef } from "react";
import { Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { findClosestMapping } from "../utils/coordinateMapping";

// SVG reference point marker icon
const svgReferenceIcon = L.divIcon({
  className: "svg-reference-marker",
  html: `<div style="width:16px;height:16px;border-radius:50%;
         background:#ff6b35; border:3px solid white; box-shadow:0 0 10px rgba(255,107,53,.8);
         display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:white;">S</div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// User location dot
const userDotIcon = L.divIcon({
  className: "user-dot",
  html: `<div style="width:14px;height:14px;border-radius:50%;
         background:#2b6; border:2px solid white; box-shadow:0 0 6px rgba(0,0,0,.35);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Haversine distance (meters)
function distMeters(a, b) {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(la1) * Math.cos(la2) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Location Mapper Component
 * 
 * Props:
 *  - onMove(latlng)           => callback with *smoothed* position
 *  - onLocationMapped(mapping) => callback when user location is mapped to SVG reference
 *  - pane                     => leaflet pane for marker/circle (default "routesPane")
 *  - accuracyMax              => reject fixes with accuracy > accuracyMax (m). default 60
 *  - staleMs                  => reject fixes older than this many ms. default 8000
 *  - ema                      => exponential moving average factor (0..1). default 0.25
 *  - jumpGuard                => max plausible speed (m/s). fixes implying more are ignored. default 8
 *  - reportRaw                => optional callback (ll, accuracy) to inspect raw fixes
 *  - showSVGReference         => show SVG reference marker when mapped (default true)
 */
export default function LocationMapper({
  onMove,
  onLocationMapped,
  pane = "routesPane",
  accuracyMax = 60,
  staleMs = 8000,
  ema = 0.25,
  jumpGuard = 8,
  reportRaw,
  showSVGReference = true,
}) {
  const map = useMap();
  const [pos, setPos] = useState(null); // smoothed position (what we render)
  const [acc, setAcc] = useState(null); // accuracy of the *last accepted raw fix*
  const [status, setStatus] = useState("initializing");
  const [errorMessage, setErrorMessage] = useState(null);
  const [debugInfo, setDebugInfo] = useState({ attempts: 0, startTime: Date.now() });
  const [currentMapping, setCurrentMapping] = useState(null); // Current location mapping
  const [mappingHistory, setMappingHistory] = useState([]); // History of mapped locations
  
  const lastRawRef = useRef(null);
  const watchIdRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const lastMappingRef = useRef(null);

  const startWatching = () => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setErrorMessage("Geolocation not supported by this browser");
      return;
    }

    const attemptStartTime = Date.now();
    const elapsed = attemptStartTime - startTimeRef.current;
    
    setStatus("initializing");
    setErrorMessage(null);
    setDebugInfo(prev => ({ 
      attempts: prev.attempts + 1, 
      startTime: startTimeRef.current,
      lastAttempt: attemptStartTime,
      totalElapsed: elapsed
    }));
    
    console.log(`🔄 Location attempt #${debugInfo.attempts + 1} started (${elapsed}ms since first attempt)`);

    const onSuccess = (p) => {
      const ll = [p.coords.latitude, p.coords.longitude];
      const a = p.coords.accuracy ?? null;
      const t = p.timestamp ? +p.timestamp : Date.now();
      const attemptTime = Date.now() - attemptStartTime;
      const totalTime = Date.now() - startTimeRef.current;

      console.log(`✅ GPS fix received after ${attemptTime}ms (total: ${totalTime}ms)`, {
        position: ll,
        accuracy: a,
        timestamp: new Date(t).toLocaleTimeString(),
        age: Date.now() - t
      });

      // surface raw if needed
      reportRaw?.(ll, a);

      // 1) reject stale/low-quality
      if (Date.now() - t > staleMs) {
        console.warn("❌ Rejected stale GPS fix:", Date.now() - t, "ms old (max:", staleMs, "ms)");
        return;
      }
      if (a && a > accuracyMax) {
        console.warn("❌ Rejected low accuracy GPS fix:", a, "m (max:", accuracyMax, "m)");
        return;
      }

      // 2) jump guard (speed limit)
      const prev = lastRawRef.current;
      if (prev) {
        const dt = Math.max(1, (t - prev.t) / 1000); // seconds
        const d = distMeters(prev.ll, ll);
        const maxAllowed = jumpGuard * dt + 15;      // small buffer
        if (d > maxAllowed) {
          console.warn("Rejected GPS jump:", d, "m in", dt, "s (max:", maxAllowed, "m)");
          return;
        }
      }

      // 3) smoothing (EMA) — keeps last good when GPS is noisy
      let smoothed;
      if (!pos) {
        smoothed = ll; // first fix
      } else {
        smoothed = [
          pos[0] + ema * (ll[0] - pos[0]),
          pos[1] + ema * (ll[1] - pos[1]),
        ];
      }

      setPos(smoothed);
      setAcc(a);
      setStatus("active");
      onMove?.(smoothed);
      lastRawRef.current = { ll, t };

      // 4) Location mapping - map real GPS to SVG reference
      mapLocationToSVG(smoothed);

      console.log(`🎯 Location accepted! Total time to first fix: ${totalTime}ms`);

      // Clear any retry timeout since we got a successful fix
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    const onError = (err) => {
      const attemptTime = Date.now() - attemptStartTime;
      const totalTime = Date.now() - startTimeRef.current;
      
      console.error(`❌ Location error after ${attemptTime}ms (total: ${totalTime}ms):`, err);
      setStatus("error");
      
      let message = "Location error";
      switch (err.code) {
        case err.PERMISSION_DENIED:
          message = "Location permission denied. Please enable location access.";
          console.error("🔒 Permission denied - user needs to allow location access");
          break;
        case err.POSITION_UNAVAILABLE:
          message = "Location unavailable. Check GPS signal and network connection.";
          console.error("📡 GPS unavailable - check signal strength and network");
          break;
        case err.TIMEOUT:
          message = "Location request timed out. Retrying...";
          setStatus("timeout");
          console.warn(`⏱️ Timeout after ${attemptTime}ms - retrying in 3 seconds`);
          
          const retryDelay = debugInfo.attempts === 1 ? 2000 : 3000;
          console.log(`🔄 Retrying in ${retryDelay}ms with ${debugInfo.attempts === 1 ? 'GPS' : 'same'} strategy`);
          
          retryTimeoutRef.current = setTimeout(() => {
            startWatching();
          }, retryDelay);
          break;
        default:
          message = `Location error: ${err.message}`;
      }
      setErrorMessage(message);
    };

    // Try fast location first, then fall back to high accuracy
    const fastOptions = {
      enableHighAccuracy: false,
      maximumAge: 10000,
      timeout: 8000,
    };
    
    const accurateOptions = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    };
    
    const options = debugInfo.attempts === 0 ? fastOptions : accurateOptions;
    console.log(`🔧 Using ${debugInfo.attempts === 0 ? 'fast' : 'accurate'} GPS options:`, options);
    
    const id = navigator.geolocation.watchPosition(onSuccess, onError, options);
    watchIdRef.current = id;
  };

  // Location mapping logic
  const mapLocationToSVG = (userPosition) => {
    const mapping = findClosestMapping({ lat: userPosition[0], lng: userPosition[1] });
    
    if (mapping) {
      // User is near a mapped location
      if (!currentMapping || currentMapping.nodeId !== mapping.nodeId) {
        // New mapping detected
        console.log(`🗺️ Location mapped: ${mapping.name} (${mapping.distance.toFixed(1)}m away)`);
        console.log(`📍 Real GPS: ${mapping.realGPS.lat}, ${mapping.realGPS.lng}`);
        console.log(`🎯 SVG Reference: ${mapping.svgGPS.lat}, ${mapping.svgGPS.lng}`);
        
        setCurrentMapping(mapping);
        
        // Add to history
        setMappingHistory(prev => [
          ...prev.slice(-9), // Keep last 10 mappings
          {
            ...mapping,
            timestamp: Date.now(),
            userPosition: [...userPosition]
          }
        ]);
        
        // Notify parent component
        onLocationMapped?.(mapping);
        
        lastMappingRef.current = mapping.nodeId;
      }
    } else {
      // User is not near any mapped location
      if (currentMapping) {
        // User left the mapped area
        console.log(`🗺️ Left mapped area: ${currentMapping.name}`);
        
        setCurrentMapping(null);
        lastMappingRef.current = null;
      }
    }
  };

  useEffect(() => {
    startWatching();

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accuracyMax, staleMs, ema, jumpGuard]);

  // If we haven't received a fresh fix in a while, lightly dim the circle
  const ageMs = lastRawRef.current ? Date.now() - lastRawRef.current.t : 0;
  const isStale = ageMs > staleMs * 2;

  // Show status indicator if there are issues
  if (status === "error" || status === "timeout") {
    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        color: status === "error" ? '#d32f2f' : '#f57c00',
        border: `1px solid ${status === "error" ? '#d32f2f' : '#f57c00'}`,
        zIndex: 1000,
        maxWidth: '250px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          {status === "error" ? "📍 Location Error" : "⏱️ Location Timeout"}
        </div>
        <div>{errorMessage}</div>
        {status === "timeout" && (
          <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
            Retrying automatically...
          </div>
        )}
      </div>
    );
  }

  if (!pos) {
    const elapsed = Math.round((Date.now() - debugInfo.startTime) / 1000);
    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#1976d2',
        border: '1px solid #1976d2',
        zIndex: 1000,
        maxWidth: '280px'
      }}>
        <div style={{ fontWeight: 'bold' }}>📍 Getting Location...</div>
        <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
          Attempt #{debugInfo.attempts} • {elapsed}s elapsed
        </div>
        <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.6 }}>
          {debugInfo.attempts === 1 ? 'Using fast location (network/cell towers)' : 'Using GPS for accuracy'}
        </div>
        <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.6 }}>
          Ensure location permissions are enabled
        </div>
      </div>
    );
  }

  return (
    <>
      {/* User location marker */}
      <Marker position={pos} icon={userDotIcon} pane={pane} />
      
      {/* Accuracy circle */}
      {acc ? (
        <Circle
          center={pos}
          radius={acc}
          pathOptions={{ 
            weight: 1, 
            opacity: isStale ? 0.3 : 0.6,
            color: isStale ? '#ff9800' : '#2b6'
          }}
          pane={pane}
        />
      ) : null}
      
      {/* SVG Reference marker - shows where user is mapped to in SVG */}
      {showSVGReference && currentMapping && (
        <Marker 
          position={[currentMapping.svgGPS.lat, currentMapping.svgGPS.lng]} 
          icon={svgReferenceIcon} 
          pane={pane}
        />
      )}
      
      {/* Location mapping status display */}
      {currentMapping && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(255, 107, 53, 0.95)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 1000,
          maxWidth: '300px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}>
          <div>🗺️ Mapped to: {currentMapping.name}</div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
            Real GPS: {currentMapping.realGPS.lat.toFixed(6)}, {currentMapping.realGPS.lng.toFixed(6)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>
            SVG Ref: {currentMapping.svgGPS.lat.toFixed(6)}, {currentMapping.svgGPS.lng.toFixed(6)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>
            Distance: {currentMapping.distance.toFixed(1)}m
          </div>
        </div>
      )}
      
      {/* Show stale indicator */}
      {isStale && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(255, 152, 0, 0.9)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          zIndex: 1000
        }}>
          ⚠️ Location may be outdated
        </div>
      )}
    </>
  );
}
