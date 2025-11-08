import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./sos.css";

export default function SOSList({ onFocus }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio("/assets/sounds/sos_alert.mp3");
    loadAlerts();

    // Real-time channel
    const channel = supabase
      .channel("sos_alerts_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos_alerts" },
        (payload) => {
          setAlerts((prev) => [payload.new, ...prev]);
          audioRef.current?.play();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadAlerts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sos_alerts")
      .select(`
        id,
        user_id,
        ride_id,
        latitude,
        longitude,
        status,
        triggered_at,
        resolved_at,
        users(email),
        rides(origin_text, destination_text)
      `)
      .order("triggered_at", { ascending: false })
      .limit(50);

    if (!error) setAlerts(data || []);
    setLoading(false);
  }

  async function resolveAlert(id) {
    await supabase
      .from("sos_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);

    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "resolved" } : a
      )
    );
  }

  return (
    <div className="sos-list">
      <h3 className="title">🚨 Active SOS Alerts</h3>
      {loading ? (
        <div className="loading">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="empty">✅ No active SOS alerts</div>
      ) : (
        alerts.map((a) => (
          <div
            key={a.id}
            className={`alert-card ${a.status === "active" ? "active" : "resolved"}`}
          >
            <div className="alert-info">
              <strong className="user">
                {a.users?.email || "Unknown User"}
              </strong>
              <p className="meta">
                Ride #{a.ride_id} —{" "}
                <span>
                  {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                </span>
              </p>
              <small>
                {new Date(a.triggered_at).toLocaleString()}
              </small>
            </div>

            <div className="alert-actions">
              <button
                className="btn-show"
                onClick={() =>
                  onFocus({ lng: a.longitude, lat: a.latitude })
                }
              >
                Show
              </button>

              {a.status === "active" && (
                <button
                  className="btn-resolve"
                  onClick={() => resolveAlert(a.id)}
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
