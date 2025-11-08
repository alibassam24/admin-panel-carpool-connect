import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import Pagination from "../Pagination"; // ✅ your component
import "./sos.css";

export default function SOSList({ onFocus }) {
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10); // adjust as needed
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio("/assets/sounds/sos_alert.mp3");
    loadAlerts();

    // Real-time new alert listener
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
  }, [sortBy, page]); // reload when page or sort changes

  // 🔹 Fetch alerts with pagination and filtering
  async function loadAlerts() {
    setLoading(true);

    let query = supabase
      .from("sos_alerts")
      .select(
        `
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
      `,
        { count: "exact" }
      );

    // exclude resolved for newest/oldest
    if (sortBy === "newest" || sortBy === "oldest") {
      query = query.eq("status", "active");
    }

    // ordering
    if (sortBy === "newest") query = query.order("triggered_at", { ascending: false });
    else if (sortBy === "oldest") query = query.order("triggered_at", { ascending: true });
    else query = query.order("triggered_at", { ascending: false }); // default fallback

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (!error) {
      setAlerts(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }

  // 🔹 Resolve alert
  async function resolveAlert(id) {
    await supabase
      .from("sos_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);

    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "resolved" } : a)));
  }

  // 🔹 Sorting logic for active/resolved
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortBy === "active") return a.status === "active" ? -1 : 1;
    if (sortBy === "resolved") return a.status === "resolved" ? -1 : 1;
    return 0; // newest/oldest handled by query
  });

  return (
    <div className="sos-list">
      <div className="header-row">
        <h3 className="title">🚨 SOS Alerts</h3>

        <select
          value={sortBy}
          onChange={(e) => {
            setPage(1); // reset to first page when sort changes
            setSortBy(e.target.value);
          }}
          className="sort-select"
        >
          <option value="newest">Newest First (Active Only)</option>
          <option value="oldest">Oldest First (Active Only)</option>
          <option value="active">Active First</option>
          <option value="resolved">Resolved First</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading alerts...</div>
      ) : sortedAlerts.length === 0 ? (
        <div className="empty">✅ No SOS alerts found</div>
      ) : (
        <>
          {sortedAlerts.map((a) => (
            <div
              key={a.id}
              className={`alert-card ${a.status === "active" ? "active" : "resolved"}`}
            >
              <div className="alert-info">
                <strong className="user">{a.users?.email || "Unknown User"}</strong>
                <p className="meta">
                  Ride #{a.ride_id} —{" "}
                  <span>
                    {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                  </span>
                </p>
                <small>{new Date(a.triggered_at).toLocaleString()}</small>
              </div>

              <div className="alert-actions">
                <button
                  className="btn-show"
                  onClick={() => onFocus(a)}
                >
                  Show
                </button>

                {a.status === "active" && (
                  <button className="btn-resolve" onClick={() => resolveAlert(a.id)}>
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* ✅ Pagination component */}
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPage={(p) => setPage(p)}
          />
        </>
      )}
    </div>
  );
}
