import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import Pagination from "../components/Pagination";

export default function RidesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState("All");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const pageSize = 10;
  const filters = useMemo(() => ({ status, origin, destination }), [status, origin, destination]);
  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr("");
      try {
        let countQ = supabase.from("rides").select("*", { count: "exact", head: true });
        if (status !== "All") countQ = countQ.eq("status", status);
        if (origin.trim()) countQ = countQ.ilike("origin_text", `%${origin}%`);
        if (destination.trim()) countQ = countQ.ilike("destination_text", `%${destination}%`);
        const { count, error: cErr } = await countQ;
        if (cErr) throw cErr;
        if (cancelled) return;
        setTotal(count || 0);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let dataQ = supabase
          .from("rides")
          .select("id, origin_text, destination_text, passenger_count, status, created_at")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (status !== "All") dataQ = dataQ.eq("status", status);
        if (origin.trim()) dataQ = dataQ.ilike("origin_text", `%${origin}%`);
        if (destination.trim()) dataQ = dataQ.ilike("destination_text", `%${destination}%`);

        const { data, error } = await dataQ;
        if (error) throw error;
        if (cancelled) return;
        setRows(data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load rides");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, filters]);

  return (
    <div className="card">
      <div className="flex-between filter-bar">
        <h2>Rides</h2>
        <div className="filters">
          <div className="filter-group">
            <label>Status</label>
            <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
              <option>All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Origin</label>
            <input className="input" placeholder="Search origin…" value={origin} onChange={e=>setOrigin(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Destination</label>
            <input className="input" placeholder="Search destination…" value={destination} onChange={e=>setDestination(e.target.value)} />
          </div>
        </div>
      </div>

      {err && <div className="error-text">{err}</div>}
      {loading && <div>Loading rides…</div>}
      {!loading && rows.length === 0 && <div>No rides found.</div>}

      {rows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Origin</th>
              <th>Destination</th>
              <th>Passengers</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.origin_text}</td>
                <td>{r.destination_text}</td>
                <td>{r.passenger_count}</td>
                <td>
                  <span className={`badge status-${r.status}`}>
                    {r.status}
                  </span>
                </td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination page={page} total={total} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}


