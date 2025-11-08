import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function SOSMap({ alerts = [], focus }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [73.0479, 33.6844], // Islamabad default
        zoom: 5,
      });
    }
  }, []);

  // 🧭 whenever "focus" changes, fly smoothly to that point
  useEffect(() => {
    if (focus && mapRef.current) {
      mapRef.current.flyTo({
        center: [focus.lng, focus.lat],
        zoom: 13,
        speed: 1.5,
        essential: true,
      });

      // optional marker drop
      new mapboxgl.Marker({ color: "#ef4444" })
        .setLngLat([focus.lng, focus.lat])
        .addTo(mapRef.current);
    }
  }, [focus]);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",
        height: "400px",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    />
  );
}
