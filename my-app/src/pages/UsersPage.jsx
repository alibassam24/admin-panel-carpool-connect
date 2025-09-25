import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import Pagination from "../components/Pagination";

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("All");
  const [status, setStatus] = useState("All");
  const pageSize = 10;

  const filters = useMemo(() => ({ q, role, status }), [q, role, status]);

  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr("");
      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from("users")
          .select(`
            id,
            email,
            role,
            status,
            created_at,
            profiles (
              phone,
              gender,
              profile_picture_url
            )
          `, { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (role !== "All") query = query.eq("role", role.toLowerCase());
        if (status !== "All") query = query.eq("status", status.toLowerCase());
        if (q.trim()) query = query.ilike("email", `%${q}%`);

        const { data, error, count } = await query;
        if (error) throw error;
        if (cancelled) return;

        setRows(data || []);
        setTotal(count || 0);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, filters]);


  useRealtime("users", fetchUsers);

  // ---- Row Actions ----
  const updateStatus = async (userId, newStatus) => {
    if (!window.confirm(`Mark this user as ${newStatus}?`)) return;
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("users")
        .update({ status: newStatus })
        .eq("id", userId);
      if (error) throw error;
      setRows(rows.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (e) {
      alert("Failed: " + (e.message || "Unexpected error"));
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Delete this user? This will cascade delete their profile, rides, docs, etc.")) return;
    setActionLoading(userId);
    try {
      const { error } = await supabase.from("users").delete().eq("id", userId);
      if (error) throw error;
      setRows(rows.filter(u => u.id !== userId));
      setTotal(total - 1);
    } catch (e) {
      alert("Delete failed: " + (e.message || "Unexpected error"));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="card">
      <div className="flex-between filter-bar">
        <h2>Users</h2>
        <div className="filters">
          <div className="filter-group">
            <label>Search</label>
            <input
              className="input"
              placeholder="Search by email…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Role</label>
            <select className="input" value={role} onChange={e=>setRole(e.target.value)}>
              <option>All</option>
              <option>carpooler</option>
              <option>passenger</option>
              <option>admin</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
              <option>All</option>
              <option>pending</option>
              <option>verified</option>
              <option>rejected</option>
            </select>
          </div>
        </div>
      </div>

      {err && <div className="error-text">{err}</div>}
      {loading && <div>Loading users…</div>}
      {!loading && rows.length === 0 && <div>No users found.</div>}

      {rows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u=>(
              <tr key={u.id}>
                <td>
                  {u.profiles?.profile_picture_url && (
                    <img
                      src={u.profiles.profile_picture_url}
                      alt="avatar"
                      style={{ width: 24, height: 24, borderRadius: "50%", marginRight: 8 }}
                    />
                  )}
                  {u.email}
                </td>
                <td>{u.role}</td>
                <td>{u.status}</td>
                <td>{u.profiles?.phone || "-"}</td>
                <td>{u.profiles?.gender || "-"}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  {actionLoading === u.id ? (
                    <span>⏳</span>
                  ) : (
                    <div className="action-buttons">
                      {/* Don’t allow changing admins */}
                      {u.role !== "admin" && (
                        <>
                          {u.status !== "verified" && (
                            <button
                              onClick={() => updateStatus(u.id, "verified")}
                              className="btn-sm btn-success"
                            >
                              Verify
                            </button>
                          )}
                          {u.status !== "rejected" && (
                            <button
                              onClick={() => updateStatus(u.id, "rejected")}
                              className="btn-sm btn-warning"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="btn-sm btn-danger"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {u.role === "admin" && <span className="text-muted">Admin (protected)</span>}
                    </div>
                  )}
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
