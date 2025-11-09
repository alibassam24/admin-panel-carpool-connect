import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import Pagination from "../Pagination";
import "./sos.css";
import sosAlertSound from '../../assets/sounds/sos_alert.mp3';


export default function SOSList({ onFocus }) {
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest");

  // 🔊 keep your original audio approach — just fix the path
  const audioRef = useRef(null);
  const lastPlayedRef = useRef(0);

  // ============ AUDIO INIT (once) ============
  useEffect(() => {
    audioRef.current = new Audio(sosAlertSound); // ✅ fixed path
    audioRef.current.preload = "auto";
    audioRef.current.volume = 1.0;

    // unlock on first click (minimal + reliable)
    const unlock = () => {
      audioRef.current
        ?.play()
        .then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        })
        .catch(() => {/* browser may block; that's fine after unlock */});
      window.removeEventListener("click", unlock);
    };
    window.addEventListener("click", unlock);

    return () => window.removeEventListener("click", unlock);
  }, []);

  // ============ REALTIME SUBSCRIPTION (once) ============
  useEffect(() => {
    const channel = supabase
      .channel("sos_alerts_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos_alerts" },
        (payload) => {
          // prepend newest
          setAlerts((prev) => [payload.new, ...prev]);
          // play sound (debounced)
          const now = Date.now();
          if (now - lastPlayedRef.current > 1200) {
            lastPlayedRef.current = now;
            audioRef.current?.pause();
            audioRef.current.currentTime = 0;
            audioRef.current?.play().catch(() => {});
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ============ FETCH (on sort/page) ============
  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, page]);

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

    // exclude resolved for newest/oldest (as you wanted)
    if (sortBy === "newest" || sortBy === "oldest") {
      query = query.eq("status", "active");
    }

    // ordering
    if (sortBy === "newest") query = query.order("triggered_at", { ascending: false });
    else if (sortBy === "oldest") query = query.order("triggered_at", { ascending: true });
    else query = query.order("triggered_at", { ascending: false });

    // pagination
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

  // resolve action stays the same
  async function resolveAlert(id) {
    await supabase
      .from("sos_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);

    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "resolved" } : a)));
  }

  // local sort for “active/resolved first”
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortBy === "active") return a.status === "active" ? -1 : 1;
    if (sortBy === "resolved") return a.status === "resolved" ? -1 : 1;
    return 0; // newest/oldest already handled by SQL ordering
  });

  return (
    <div className="sos-list">
      <div className="header-row">
        <h3 className="title">🚨 SOS Alerts</h3>

        <select
          value={sortBy}
          onChange={(e) => {
            setPage(1);
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
                    {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}
                  </span>
                </p>
                <small>{new Date(a.triggered_at).toLocaleString()}</small>
              </div>

              <div className="alert-actions">
                <button className="btn-show" onClick={() => onFocus(a)}>
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
