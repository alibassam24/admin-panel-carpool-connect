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
import "../../src/dashboard.css"; // custom CSS

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

  if (loading)
    return (
      <div className="loading-state">Loading dashboard…</div>
    );

  if (err)
    return (
      <div className="error-state">
        <AlertCircle className="icon" />
        <p className="msg">{err}</p>
        <button onClick={fetchStats} className="retry-btn">
          <RefreshCcw size={16} /> Retry
        </button>
      </div>
    );

  const cards = [
    {
      title: "Total Users",
      value: stats.users,
      icon: <Users className="text-blue-600" size={30} />,
      colorClass: "gradient-blue",
    },
    {
      title: "Total Rides",
      value: stats.rides,
      icon: <Car className="text-green-600" size={30} />,
      colorClass: "gradient-green",
    },
    {
      title: "Complaints",
      value: stats.complaints,
      icon: <FileWarning className="text-yellow-600" size={30} />,
      colorClass: "gradient-yellow",
    },
    {
      title: "Driver Verifications (Pending)",
      value: stats.verificationsPending,
      icon: <ClipboardCheck className="text-purple-600" size={30} />,
      colorClass: "gradient-purple",
    },
    {
      title: "Petrol Price",
      value: stats.petrolPrice,
      icon: <Fuel className="text-red-600" size={30} />,
      colorClass: "gradient-red",
    },
  ];

  const StatusChart = ({ title, data }) => (
    <div className="dashboard-box hover-lift">
      <h3 className="chart-title">{title}</h3>
      {data?.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barSize={30}>
            <XAxis dataKey="status" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][i % 4]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="no-data">No data available</p>
      )}
    </div>
  );

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Admin Dashboard</h1>

      {/* Cards */}
      <div className="dashboard-grid">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`dashboard-box ${card.colorClass} hover-lift flex justify-between items-center`}
          >
            <div>
              <h3 className="card-title">{card.title}</h3>
              <p className="card-value">{card.value}</p>
            </div>
            <div className="icon-box">{card.icon}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="dashboard-charts">
        <StatusChart title="Users by Status" data={stats.usersByStatus} />
        <StatusChart title="Rides by Status" data={stats.ridesByStatus} />
        <StatusChart title="Complaints by Status" data={stats.complaintsByStatus} />
        <StatusChart title="Driver Docs by Status" data={stats.driverDocsByStatus} />
      </div>
    </div>
  );
}
