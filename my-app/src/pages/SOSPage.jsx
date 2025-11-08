import { useState } from "react";
import SOSMap from "../components/sos/SOSMap";
import SOSList from "../components/sos/SOSList";
import "./../components/sos/sos.css";

export default function SOSPage() {
  const [focus, setFocus] = useState(null); // 🧭 <-- this controls map focus

  return (
    <div className="sos-page">
      <h1 className="sos-title">🚨 SOS Control Center</h1>
      <p className="sos-subtitle">
        Monitor live emergency alerts from drivers and riders.
      </p>

      <div className="sos-grid">
        <SOSMap focus={focus} />
        <SOSList onFocus={(coords) => setFocus(coords)} /> {/* 🔗 Link */}
      </div>
    </div>
  );
}
