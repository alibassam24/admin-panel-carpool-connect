import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Pagination from "../components/Pagination";

export default function ComplaintsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");

  const pageSize = 10;
  const filters = useMemo(() => ({ status, q }), [status, q]);
  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr("");
      try {
        let countQ = supabase.from("complaints").select("*", { count: "exact", head: true });
        if (status !== "All") countQ = countQ.eq("status", status);
        if (q.trim()) countQ = countQ.ilike("complaint_text", `%${q}%`);
        const { count, error: cErr } = await countQ;
        if (cErr) throw cErr;
        if (cancelled) return;
        setTotal(count || 0);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let dataQ = supabase
          .from("complaints")
         .select(`
  id,
  user_id,
  ride_id,
  complaint_text,
  status,
  created_at,
  profiles:profiles(full_name)
`)

          .order("created_at", { ascending: false })
          .range(from, to);
        if (status !== "All") dataQ = dataQ.eq("status", status);
        if (q.trim()) dataQ = dataQ.ilike("complaint_text", `%${q}%`);

        const { data, error } = await dataQ;
        if (error) throw error;
        if (cancelled) return;
        setRows(data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load complaints");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, filters]);
 
  // Admin action: update status
  const updateStatus = async (id, newStatus) => {
    if (!window.confirm(`Mark complaint #${id} as ${newStatus}?`)) return;
    try {
      const { error } = await supabase.from("complaints").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
      setRows(rows.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (e) {
      alert("Update failed: " + (e.message || "Unexpected error"));
    }
  };

  return (
    <div className="card">
      <div className="flex-between filter-bar">
        <h2>Complaints</h2>
        <div className="filters">
          <div className="filter-group">
            <label>Search</label>
            <input
              className="input"
              placeholder="Search complaints…"
              value={q}
              onChange={e=>setQ(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
              <option>All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {err && <div className="error-text">{err}</div>}
      {loading && <div>Loading complaints…</div>}
      {!loading && rows.length === 0 && <div>No complaints yet 🎉</div>}

      {rows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Ride</th>
              <th>Complaint</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c=>(
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.profiles?.full_name || c.user_id}</td>
                <td>{c.ride_id || "-"}</td>
                <td title={c.complaint_text}>
                  {c.complaint_text.length > 40
                    ? c.complaint_text.slice(0, 40) + "…"
                    : c.complaint_text}
                </td>
                <td>
                  <span className={`badge status-${c.status}`}>
                    {c.status}
                  </span>
                </td>
                <td>{new Date(c.created_at).toLocaleString()}</td>
                <td>
                  <div className="action-buttons">
                    {c.status !== "resolved" && (
                      <button
                        onClick={() => updateStatus(c.id, "resolved")}
                        className="btn-sm btn-success"
                      >
                        Resolve
                      </button>
                    )}
                    {c.status === "open" && (
                      <button
                        onClick={() => updateStatus(c.id, "in_progress")}
                        className="btn-sm btn-warning"
                      >
                        In Progress
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination page={page} total={total} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}
