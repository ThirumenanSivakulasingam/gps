// components/Navigator.jsx
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { computeRoute } from "../routing/computeRoute";

const campusBounds = L.latLngBounds([/* SW */], [/* NE */]); // fill if you have

function RouteLayer({ destBuildingId, userCoord }) {
  const [route, setRoute] = useState(null);

  useEffect(() => {
    if (!userCoord || !destBuildingId) return;
    const r = computeRoute({ userCoord, destBuildingId });
    setRoute(r.ok ? r : null);
  }, [userCoord, destBuildingId]);

  if (!route) return null;
  return <Polyline positions={route.polyline} />;
}

function Locator({ onPosition }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      p => {
        const coord = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(coord);
        onPosition && onPosition(coord);
      },
      err => console.warn("geo error", err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [onPosition]);

  return pos ? <Marker position={pos} /> : null;
}

export default function Navigator() {
  const [userCoord, setUserCoord] = useState(null);
  const [dest, setDest] = useState("EE"); // pick from a dropdown in your UI

  return (
    <MapContainer style={{height:"100vh", width:"100%"}} zoom={17} center={[7.2539, 80.5918]}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <Locator onPosition={setUserCoord} />
      <RouteLayer destBuildingId={dest} userCoord={userCoord} />
    </MapContainer>
  );
}
