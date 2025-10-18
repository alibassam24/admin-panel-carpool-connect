import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const countBy = (rows, key) => {
    const map = new Map();
    for (const r of rows || []) {
      const k = r[key] ?? "unknown";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map, ([status, count]) => ({ status, count }));
  };

  const fetchStats = async () => {
    try {
      setErr("");
      setLoading(true);

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

      const throwIfErr = (res) => {
        if (res.error) throw res.error;
      };
      [u, r, c, v, petrol].forEach(throwIfErr);

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

      const safeGroup = async (rpcRes, table) => {
        if (rpcRes.error || !rpcRes.data) {
          const { data, error } = await supabase.from(table).select("status");
          if (error) throw error;
          return countBy(data, "status");
        }
        return rpcRes.data;
      };

      const usersByStatus = await safeGroup(usersGroupedRes, "users");
      const ridesByStatus = await safeGroup(ridesGroupedRes, "rides");
      const complaintsByStatus = await safeGroup(
        complaintsGroupedRes,
        "complaints"
      );
      const driverDocsByStatus = await safeGroup(
        docsGroupedRes,
        "driver_documents"
      );

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
      console.error("Dashboard fetch error:", e);
      setErr(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const tables = [
      "users",
      "rides",
      "complaints",
      "driver_documents",
      "settings",
    ];

    const channels = tables.map((table) =>
      supabase
        .channel(`${table}-changes`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          fetchStats();
        })
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, []);

  // ---------------- UI ----------------
  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading dashboard…
      </div>
    );

  if (err)
    return (
      <div className="text-center py-10">
        <p className="text-red-500 mb-4 font-semibold">{err}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Retry
        </button>
      </div>
    );

  const StatCard = ({ title, value }) => (
    <div className="card bg-white/90 dark:bg-gray-800 p-4 rounded-xl shadow-md hover:shadow-lg transition">
      <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
        {title}
      </h3>
      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
        {value}
      </p>
    </div>
  );

  const StatusList = ({ title, data }) => (
    <div className="card bg-white/90 dark:bg-gray-800 p-4 rounded-xl shadow-md">
      <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">
        {title}
      </h3>
      {data?.length ? (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          {data.map((x) => (
            <li key={x.status} className="py-1 flex justify-between">
              <span className="capitalize">{x.status}</span>
              <span className="font-semibold">{x.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-sm italic">No data</p>
      )}
    </div>
  );

  return (
    <div className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <StatCard title="Total Users" value={stats.users} />
      <StatCard title="Total Rides" value={stats.rides} />
      <StatCard title="Complaints" value={stats.complaints} />
      <StatCard
        title="Driver Verifications (Pending)"
        value={stats.verificationsPending}
      />
      <StatCard title="Petrol Price" value={stats.petrolPrice} />

      <StatusList title="Users by Status" data={stats.usersByStatus} />
      <StatusList title="Rides by Status" data={stats.ridesByStatus} />
      <StatusList
        title="Complaints by Status"
        data={stats.complaintsByStatus}
      />
      <StatusList
        title="Driver Docs by Status"
        data={stats.driverDocsByStatus}
      />
    </div>
  );
}
