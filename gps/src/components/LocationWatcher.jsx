// components/LocationWatcher.jsx
import { useEffect, useRef, useState } from "react";
import { Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";

// simple green dot
const dotIcon = L.divIcon({
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
 * LocationWatcher (improved)
 *
 * Props:
 *  - onMove(latlng)    => callback with *smoothed* position
 *  - pane              => leaflet pane for marker/circle (default "routesPane")
 *  - accuracyMax       => reject fixes with accuracy > accuracyMax (m). default 60
 *  - staleMs           => reject fixes older than this many ms. default 8000
 *  - ema               => exponential moving average factor (0..1). default 0.25
 *  - jumpGuard         => max plausible speed (m/s). fixes implying more are ignored. default 8
 *  - reportRaw         => optional callback (ll, accuracy) to inspect raw fixes
 */
export default function LocationWatcher({
  onMove,
  pane = "routesPane",
  accuracyMax = 60,
  staleMs = 8000,
  ema = 0.25,
  jumpGuard = 8,
  reportRaw,
}) {
  const map = useMap();
  const [pos, setPos] = useState(null); // smoothed position (what we render)
  const [acc, setAcc] = useState(null); // accuracy of the *last accepted raw fix*
  const lastRawRef = useRef(null);      // { ll:[lat,lng], t:ms }
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      console.warn("Geolocation not supported");
      return;
    }

    const onSuccess = (p) => {
      const ll = [p.coords.latitude, p.coords.longitude];
      const a = p.coords.accuracy ?? null;
      const t = p.timestamp ? +p.timestamp : Date.now();

      // surface raw if needed
      reportRaw?.(ll, a);

      // 1) reject stale/low-quality
      if (Date.now() - t > staleMs) return;
      if (a && a > accuracyMax) return;

      // 2) jump guard (speed limit)
      const prev = lastRawRef.current;
      if (prev) {
        const dt = Math.max(1, (t - prev.t) / 1000); // seconds
        const d = distMeters(prev.ll, ll);
        const maxAllowed = jumpGuard * dt + 15;      // small buffer
        if (d > maxAllowed) {
          // ignore improbable teleport
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
      onMove?.(smoothed);
      lastRawRef.current = { ll, t };
    };

    const onError = (err) => {
      // Keep rendering the *last good* pos; just log error.
      console.warn("Geolocation error:", err);
    };

    const id = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 3000,  // allow a cached fix up to 3s
      timeout: 10000,
    });
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accuracyMax, staleMs, ema, jumpGuard]); // keep options reactive

  if (!pos) return null;

  // If we haven't received a fresh fix in a while, lightly dim the circle
  const ageMs = lastRawRef.current ? Date.now() - lastRawRef.current.t : 0;
  const isStale = ageMs > staleMs * 2;

  return (
    <>
      <Marker position={pos} icon={dotIcon} pane={pane} />
      {acc ? (
        <Circle
          center={pos}
          radius={acc}
          pathOptions={{ weight: 1, opacity: isStale ? 0.3 : 0.6 }}
          pane={pane}
        />
      ) : null}
    </>
  );
}
