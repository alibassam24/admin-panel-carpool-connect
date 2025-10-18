import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Users,
  Car,
  FileWarning,
  ClipboardCheck,
  Fuel,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";

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
      <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse">
        Loading dashboard…
      </div>
    );

  if (err)
    return (
      <div className="text-center py-10">
        <AlertCircle className="mx-auto text-red-500 w-10 h-10 mb-3" />
        <p className="text-red-500 mb-4 font-semibold">{err}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 mx-auto"
        >
          <RefreshCcw size={16} /> Retry
        </button>
      </div>
    );

  const cards = [
    {
      title: "Total Users",
      value: stats.users,
      icon: <Users className="text-blue-500" size={24} />,
    },
    {
      title: "Total Rides",
      value: stats.rides,
      icon: <Car className="text-green-500" size={24} />,
    },
    {
      title: "Complaints",
      value: stats.complaints,
      icon: <FileWarning className="text-yellow-500" size={24} />,
    },
    {
      title: "Driver Verifications (Pending)",
      value: stats.verificationsPending,
      icon: <ClipboardCheck className="text-purple-500" size={24} />,
    },
    {
      title: "Petrol Price",
      value: stats.petrolPrice,
      icon: <Fuel className="text-red-500" size={24} />,
    },
  ];

  const StatusChart = ({ title, data }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
      <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
        {title}
      </h3>
      {data?.length ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="status" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][
                      index % 4
                    ] /* cycle colors */
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-gray-500 text-sm italic">No data available</p>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md flex items-center justify-between hover:shadow-lg transition"
          >
            <div>
              <h3 className="text-gray-600 dark:text-gray-300 text-sm font-semibold">
                {card.title}
              </h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {card.value}
              </p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Status Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <StatusChart title="Users by Status" data={stats.usersByStatus} />
        <StatusChart title="Rides by Status" data={stats.ridesByStatus} />
        <StatusChart
          title="Complaints by Status"
          data={stats.complaintsByStatus}
        />
        <StatusChart
          title="Driver Docs by Status"
          data={stats.driverDocsByStatus}
        />
      </div>
    </div>
  );
}
