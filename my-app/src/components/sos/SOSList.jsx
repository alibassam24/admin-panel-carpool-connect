import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import Pagination from "../Pagination";
import "./sos.css";

export default function SOSList({ onFocus }) {
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  const [soundReady, setSoundReady] = useState(false);
  const audioRef = useRef(null);
  const lastPlayedRef = useRef(0);

  // ===================================================
  // 🎧 Initialize Audio Element
  // ===================================================
  useEffect(() => {
    console.log("🎧 Initializing native Audio element...");
    audioRef.current = new Audio("src/assets/sounds/sos_alert.mp3");
    audioRef.current.preload = "auto";
    audioRef.current.volume = 1.0;

    audioRef.current.oncanplaythrough = () => {
      console.log("✅ SOS alert sound loaded successfully.");
    };

    audioRef.current.onerror = (e) => {
      console.error("❌ Error loading SOS sound file:", e);
      console.log("🔎 Check file path: src/assets/sounds/sos_alert.mp3");
    };
  }, []);

  // ===================================================
  // 🟢 Unlock audio on first user gesture
  // ===================================================
  useEffect(() => {
    const unlock = async () => {
      try {
        if (audioRef.current) {
          await audioRef.current.play().then(() => {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            console.log("🔊 Audio unlocked for future alerts");
            setSoundReady(true);
          });
        }
      } catch (e) {
        console.warn("⚠️ Could not auto-play (browser blocked):", e);
      }
      window.removeEventListener("click", unlock);
    };
    window.addEventListener("click", unlock);
    return () => window.removeEventListener("click", unlock);
  }, []);

  // ===================================================
  // 🚨 Safe Sound Playback
  // ===================================================
  const playSOS = () => {
    const now = Date.now();
    if (now - lastPlayedRef.current < 1500) return; // debounce
    lastPlayedRef.current = now;

    if (!audioRef.current) {
      console.warn("⚠️ Audio element not ready");
      return;
    }

    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn("🚫 Audio play blocked:", err);
      });
      console.log("▶️ SOS sound played");
    } catch (err) {
      console.error("❌ Audio playback failed:", err);
    }
  };

  // ===================================================
  // 📡 Load alerts
  // ===================================================
  async function loadAlerts() {
    setLoading(true);
    console.log("📥 Fetching alerts, sort:", sortBy);

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

    if (sortBy === "newest" || sortBy === "oldest") query = query.eq("status", "active");
    if (sortBy === "newest") query = query.order("triggered_at", { ascending: false });
    else if (sortBy === "oldest") query = query.order("triggered_at", { ascending: true });
    else query = query.order("triggered_at", { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) console.error("❌ Error loading alerts:", error);
    else console.log(`✅ Loaded ${data?.length || 0} alerts (count=${count})`);

    setAlerts(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  // ===================================================
  // 🛰️ Supabase Realtime Subscription
  // ===================================================
  useEffect(() => {
    loadAlerts();

    const channel = supabase
      .channel("sos_alerts_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos_alerts" },
        (payload) => {
          const newAlert = payload.new;
          console.log("🚨 New SOS alert received:", newAlert);
          setAlerts((prev) => [newAlert, ...prev]);
          playSOS();
        }
      )
      .subscribe((status) => console.log("📡 Realtime channel:", status));

    return () => {
      console.log("🧹 Unsubscribing Realtime channel...");
      supabase.removeChannel(channel);
    };
  }, [sortBy, page]);

  // ===================================================
  // ✅ Resolve Alert
  // ===================================================
  async function resolveAlert(id) {
    console.log("✅ Resolving alert:", id);
    await supabase
      .from("sos_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);

    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "resolved" } : a))
    );
  }

  // ===================================================
  // 🔃 Sort active/resolved
  // ===================================================
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortBy === "active") return a.status === "active" ? -1 : 1;
    if (sortBy === "resolved") return a.status === "resolved" ? -1 : 1;
    return 0;
  });

  // ===================================================
  // 🖼️ Render
  // ===================================================
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

      <div
        style={{
          textAlign: "center",
          marginBottom: "8px",
          fontSize: "0.85rem",
          color: soundReady ? "#22c55e" : "#f87171",
        }}
      >
        {soundReady ? "🔊 Sound Enabled - Waiting for SOS..." : "🔒 Click anywhere to enable sound"}
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
                    {a.latitude?.toFixed?.(4)}, {a.longitude?.toFixed?.(4)}
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

          <Pagination page={page} total={total} pageSize={pageSize} onPage={(p) => setPage(p)} />
        </>
      )}
    </div>
  );
}
