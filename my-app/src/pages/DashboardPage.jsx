import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  // Fallback aggregator if RPCs don’t exist yet
  const countBy = (rows, key) => {
    const map = new Map();
    for (const r of rows || []) {
      const k = r[key] ?? "unknown";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map, ([status, count]) => ({ status, count }));
  };

  // ---------------- Fetch Function ----------------
  const fetchStats = async () => {
    try {
      setErr("");

      // --- Totals (cheap HEAD counts) ---
      const [u, r, c, v, petrol] = await Promise.all([
        supabase.from("users").select("*", { head: true, count: "exact" }),
        supabase.from("rides").select("*", { head: true, count: "exact" }),
        supabase.from("complaints").select("*", { head: true, count: "exact" }),
        supabase
          .from("driver_documents")
          .select("*", { head: true, count: "exact" })
          .eq("status", "pending"),
        supabase
          .from("settings")
          .select("value")
          .eq("key", "petrol")
          .maybeSingle(),
      ]);

      if (u.error) throw u.error;
      if (r.error) throw r.error;
      if (c.error) throw c.error;
      if (v.error) throw v.error;
      if (petrol.error) throw petrol.error;

      // --- Grouped counts via RPCs (with safe fallback) ---
      const [
        usersGroupedRes,
        ridesGroupedRes,
        complaintsGroupedRes,
        docsGroupedRes,
      ] = await Promise.all([
        supabase.rpc("users_status_counts"),
        supabase.rpc("rides_status_counts"),
        supabase.rpc("complaints_status_counts"),
        supabase.rpc("driver_docs_status_counts"),
      ]);

      let usersByStatus = usersGroupedRes.data;
      let ridesByStatus = ridesGroupedRes.data;
      let complaintsByStatus = complaintsGroupedRes.data;
      let driverDocsByStatus = docsGroupedRes.data;

      // Fallback client-side grouping if RPC missing
      if (usersGroupedRes.error || !usersByStatus) {
        const { data, error } = await supabase.from("users").select("status");
        if (error) throw error;
        usersByStatus = countBy(data, "status");
      }
      if (ridesGroupedRes.error || !ridesByStatus) {
        const { data, error } = await supabase.from("rides").select("status");
        if (error) throw error;
        ridesByStatus = countBy(data, "status");
      }
      if (complaintsGroupedRes.error || !complaintsByStatus) {
        const { data, error } = await supabase
          .from("complaints")
          .select("status");
        if (error) throw error;
        complaintsByStatus = countBy(data, "status");
      }
      if (docsGroupedRes.error || !driverDocsByStatus) {
        const { data, error } = await supabase
          .from("driver_documents")
          .select("status");
        if (error) throw error;
        driverDocsByStatus = countBy(data, "status");
      }

      setStats({
        users: u.count ?? 0,
        rides: r.count ?? 0,
        complaints: c.count ?? 0,
        verificationsPending: v.count ?? 0,
        petrolPrice: petrol.data?.value ?? "N/A",
        usersByStatus,
        ridesByStatus,
        complaintsByStatus,
        driverDocsByStatus,
      });
    } catch (e) {
      setErr(e.message || "Failed to load dashboard");
    }
  };

  // ---------------- Effects ----------------
  useEffect(() => {
    fetchStats();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const tables = ["users", "rides", "complaints", "driver_documents", "settings"];

    const channels = tables.map((table) =>
      supabase
        .channel(`${table}-changes`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) => {
            console.log(`🔄 Change detected on ${table}:`, payload);
            fetchStats(); // refresh dashboard
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, []);

  // ---------------- Render ----------------
  if (err) return <div className="error-text">{err}</div>;
  if (!stats) return <div>Loading dashboard…</div>;

  return (
    <div className="grid dashboard-grid">
      <div className="card"><b>Total Users</b><div>{stats.users}</div></div>
      <div className="card"><b>Total Rides</b><div>{stats.rides}</div></div>
      <div className="card"><b>Complaints</b><div>{stats.complaints}</div></div>
      <div className="card"><b>Driver Verifications (Pending)</b><div>{stats.verificationsPending}</div></div>
      <div className="card"><b>Petrol Price</b><div>{stats.petrolPrice}</div></div>

      <div className="card">
        <h3>Users by Status</h3>
        <ul>{stats.usersByStatus.map(x => <li key={x.status}>{x.status}: {x.count}</li>)}</ul>
      </div>
      <div className="card">
        <h3>Rides by Status</h3>
        <ul>{stats.ridesByStatus.map(x => <li key={x.status}>{x.status}: {x.count}</li>)}</ul>
      </div>
      <div className="card">
        <h3>Complaints by Status</h3>
        {stats.complaintsByStatus.length > 0 ? (
          <ul>{stats.complaintsByStatus.map(x => <li key={x.status}>{x.status}: {x.count}</li>)}</ul>
        ) : (
          <p>No complaints yet 🎉</p>
        )}
      </div>
      <div className="card">
        <h3>Driver Docs by Status</h3>
        <ul>{stats.driverDocsByStatus.map(x => <li key={x.status}>{x.status}: {x.count}</li>)}</ul>
      </div>
    </div>
  );
}
