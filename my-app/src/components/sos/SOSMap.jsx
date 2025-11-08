import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "./sos.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function SOSMap({ alerts = [], focus }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [selected, setSelected] = useState(null);

  // === Initialize Map ===
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [73.0479, 33.6844],
      zoom: 5,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    window.addEventListener("resize", () => map.resize());
    return () => map.remove();
  }, []);

  // === Focus alert when "Show" clicked ===
 useEffect(() => {
  if (!focus || !mapRef.current) return;
  const map = mapRef.current;

  const lng = focus.longitude ?? focus.lng;
  const lat = focus.latitude ?? focus.lat;
  if (lng == null || lat == null) return; // guard

  // remove previous marker
  if (markerRef.current) markerRef.current.remove();

  // create new marker
  const el = document.createElement("div");
  el.className = "sos-marker";
  markerRef.current = new mapboxgl.Marker(el)
    .setLngLat([lng, lat])
    .addTo(map);

  map.flyTo({
    center: [lng, lat],
    zoom: 13.5,
    speed: 1.4,
    curve: 1.4,
    essential: true,
  });

  setSelected(focus); // shows info box
}, [focus]);


  return (
    <div className="sos-map-wrapper">
      <div ref={mapContainer} className="sos-map-container" />

      {/* ✅ Floating info box */}
      {selected && (
        <div className="map-info-box">
          <div className="info-header">
            <h4>🚨 SOS Alert</h4>
            <button onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="info-body">
            <p><strong>User:</strong> {selected.users?.email || "Unknown"}</p>
            <p><strong>Ride ID:</strong> #{selected.ride_id}</p>
            <p><strong>Status:</strong> {selected.status}</p>
            <p><strong>Triggered:</strong> {new Date(selected.triggered_at).toLocaleString()}</p>
            <p><strong>Route:</strong> {selected.rides?.origin_text || "?"} → {selected.rides?.destination_text || "?"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
