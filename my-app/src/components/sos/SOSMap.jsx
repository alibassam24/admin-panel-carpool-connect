import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "./sos.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function SOSMap({ focus }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [selected, setSelected] = useState(null);

  // === Initialize map ===
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [73.0479, 33.6844], // Islamabad default
      zoom: 5,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("sos-point", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Circle fallback (always visible)
      map.addLayer({
        id: "sos-point-circle",
        type: "circle",
        source: "sos-point",
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Optional icon layer
      map.loadImage(
        "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        (err, image) => {
          if (err || !image) return;
          if (!map.hasImage("sos-pin")) map.addImage("sos-pin", image);
          map.addLayer({
            id: "sos-point-symbol",
            type: "symbol",
            source: "sos-point",
            layout: {
              "icon-image": "sos-pin",
              "icon-size": 0.1,
              "icon-anchor": "bottom",
              "icon-allow-overlap": true,
            },
          });
        }
      );
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
    };
  }, []);

  // === Update marker when “Show” clicked ===
  useEffect(() => {
    if (!focus || !mapRef.current) return;
    const map = mapRef.current;

    let lat = parseFloat(focus.latitude ?? focus.lat);
    let lng = parseFloat(focus.longitude ?? focus.lng);

    // 🔍 Detect reversed coords
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      const temp = lat;
      lat = lng;
      lng = temp;
      console.warn("⚠️ Detected swapped coordinates, auto-corrected:", lng, lat);
    }

    if (
      isNaN(lng) ||
      isNaN(lat) ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      console.error("❌ Invalid coordinates:", { lng, lat });
      return;
    }

    const updateMarker = () => {
      const src = map.getSource("sos-point");
      if (!src) return;

      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
          },
        ],
      };
      src.setData(geojson);

      map.flyTo({
        center: [lng, lat],
        zoom: 15,
        speed: 1.3,
        curve: 1.2,
        essential: true,
      });
    };

    if (!map.isStyleLoaded()) map.once("load", updateMarker);
    else updateMarker();

    setSelected(focus);
  }, [focus]);

  return (
    <div className="sos-map-wrapper">
      <div ref={mapContainer} className="sos-map-container" />

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
