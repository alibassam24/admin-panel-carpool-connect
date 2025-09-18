import React, { useMemo, useState, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import './styles.css';
import { useNavigate } from "react-router-dom";

import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer
} from "recharts";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

/********************** Mock Data **********************/
const mockUsers = Array.from({ length: 12 }).map((_, i) => ({
  id: i + 1,
  name: ["Ayesha Khan","Ali Raza","Fatima Noor","Zain Ahmed","Sara Malik","Hassan J."][i % 6],
  email: `user${i+1}@mail.com`,
  role: i % 2 === 0 ? "Carpooler" : "Rider",
  status: i % 3 === 0 ? "Suspended" : "Active",
  joined: "2025-09-01"
}));

const mockVerifications = Array.from({ length: 4 }).map((_, i) => ({
  id: 100 + i,
  name: mockUsers[i].name,
  email: mockUsers[i].email,
  licenseUrl: "https://picsum.photos/200/120?random=" + i,
  plateUrl: "https://picsum.photos/200/120?plate=" + i,
  status: i % 2 === 0 ? "Pending" : "Approved",
  notes: ""
}));

const mockRides = Array.from({ length: 6 }).map((_, i) => ({
  id: 300 + i,
  origin: "Gulshan",
  destination: "Saddar",
  passengers: 2,
  genderPref: "Any",
  status: ["ongoing","completed","cancelled"][i % 3],
  carpooler: "Ali Raza",
  rider: "Ayesha Khan",
  lat: 24.86 + i * 0.01,
  lng: 67.01 + i * 0.01,
}));

const dailyStats = Array.from({ length: 7 }).map((_, i) => ({
  day: `Day ${i+1}`,
  rides: 20 + Math.round(Math.random()*15),
  revenue: 300 + Math.round(Math.random()*150),
}));

/********************** Auth Context **********************/
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }){
  const [user, setUser] = useState(null); // no auto-restore

  const login = (email) => {
    const u = { email };
    setUser(u);
    localStorage.setItem("cc_admin_user", JSON.stringify(u));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem("cc_admin_user");
  };
  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

function ProtectedRoute({ children }){
  const { user } = useAuth();
  const loc = useLocation();
  if(!user){ return <Navigate to="/login" state={{ from: loc }} replace /> }
  return children;
}

/********************** Icons **********************/
const Icon = {
  logo: () => <div className="logo-square"></div>
}

/********************** Layout **********************/
function Topbar(){
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <div className="container flex-between">
        <div className="flex-center gap-md">
          <Icon.logo />
          <div className="brand-text">Carpool Connect — Admin</div>
          <span className="badge">Developer Mode</span>
        </div>
        <div className="flex-center gap-md">
          <div className="user-email">{user?.email}</div>
          <button className="btn btn-primary btn-sm flex-center gap-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

function Sidebar(){
  const loc = useLocation();
  const NavLink = ({ to, label }) => (
    <Link to={to} className={`sidebar-link ${loc.pathname===to ? 'active-link' : ''}`}>
      {label}
    </Link>
  );
  return (
    <div className="sidebar">
      <NavLink to="/" label="Dashboard" />
      <NavLink to="/users" label="Users" />
      <NavLink to="/verification" label="Verification" />
      <NavLink to="/rides" label="Rides" />
      <NavLink to="/settings" label="Settings" />
      <NavLink to="/complaints" icon={<Icon.users/>} label="Complaints" />

    </div>
  )
}

function AppShell({ children }){
  const loc = useLocation();
  return (
    <div className="shell">
      <Topbar />
      <div className="shell-main">
        <Sidebar />
        <div className="page">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname}
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
              transition={{ duration:0.25 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/********************** Pages **********************/
function LoginPage(){
   const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const navigate = useNavigate();  // ✅ here

  const onSubmit = (e)=>{
    e.preventDefault();
    if(!email || !password){
      setErr("Please enter email and password");
      return;
    }
    if(email === "admin@carpool.app" && password === "admin123"){
      login(email);
      navigate("/");   // ✅ send user to dashboard
    } else {
      setErr("Invalid credentials");
    }
  };
  return (
    <div className="login-wrapper">
      <div className="login-box card card-lg">
        <div className="login-header">
          <Icon.logo />
          <h1 className="auth-title">Carpool Connect Admin</h1>
        </div>
        <p className="login-subtitle">Developer / Admin access only</p>
        <form onSubmit={onSubmit} className="form login-form">
          <label>Email</label>
          <input className="input" placeholder="admin@carpool.app"
            value={email} onChange={e=>setEmail(e.target.value)} />
          
          <label>Password</label>
          <input className="input" type="password" placeholder="••••••••"
            value={password} onChange={e=>setPassword(e.target.value)} />
          
          {err && <div className="error-text">{err}</div>}
          <button type="submit" className="btn btn-primary full-width login-btn">
  Login
</button>

        </form>
        <div className="forgot-link">
          <a href="#">Forgot Password?</a>
        </div>
      </div>
    </div>
  )
}

function DashboardPage(){
  const ongoing = mockRides.filter(r=>r.status==='ongoing').length;
  const completed = mockRides.filter(r=>r.status==='completed').length;
  const cancelled = mockRides.filter(r=>r.status==='cancelled').length;

  return (
    <div>
      <div className="grid">
        <div className="card">Active Rides: {ongoing}</div>
        <div className="card">Completed: {completed}</div>
        <div className="card">Cancelled: {cancelled}</div>
      </div>
      <div className="card chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dailyStats}>
            <CartesianGrid stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="day" stroke="#a2c7bb" />
            <YAxis stroke="#a2c7bb" />
            <Tooltip />
            <Line type="monotone" dataKey="rides" stroke="#3aa17b" />
            <Line type="monotone" dataKey="revenue" stroke="#6be0b5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function UsersPage(){
  return (
    <div className="card">
      <h2>Users</h2>
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          {mockUsers.map(u=>(
            <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VerificationPage(){
  return (
    <div className="grid">
      {mockVerifications.map(v=>(
        <div className="card" key={v.id}>
          <h3>{v.name}</h3>
          <img src={v.licenseUrl} alt="License" />
          <div>Status: {v.status}</div>
        </div>
      ))}
    </div>
  )
}

function RidesPage(){
  return (
    <div className="card">
      <h2>Rides</h2>
      <table className="table">
        <thead><tr><th>ID</th><th>Origin</th><th>Destination</th><th>Status</th></tr></thead>
        <tbody>
          {mockRides.map(r=>(
            <tr key={r.id}><td>{r.id}</td><td>{r.origin}</td><td>{r.destination}</td><td>{r.status}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}/* 
function ComplaintsPage(){
  const [status, setStatus] = useState("All");
  const [query, setQuery] = useState("");

  const mockComplaints = Array.from({ length: 12 }).map((_, i) => ({
    id: 500 + i,
    user: mockUsers[i].name,
    email: mockUsers[i].email,
    type: ["Ride Issue", "Payment", "Verification", "Other"][i % 4],
    message: ["Driver cancelled mid-way", "Payment not processed", "Docs rejected unfairly", "App crashed while booking"][i % 4],
    status: i % 3 === 0 ? "Pending" : i % 3 === 1 ? "Resolved" : "In Review",
    date: `2025-09-${(i % 27) + 1}`.replace(/-(\d)(?=\b)/g,'-0$1'),
  }));

  const filtered = mockComplaints.filter(c=>{
    const matchQ = `${c.user} ${c.email} ${c.message}`.toLowerCase().includes(query.toLowerCase());
    const matchS = status === "All" || c.status === status;
    return matchQ && matchS;
  });

  const updateStatus = (id, newStatus) => {
    // frontend-only mock update
    alert(`Complaint #${id} marked as ${newStatus}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Complaints</h2>
          <div className="text-sm text-white/60">User-reported issues & resolutions</div>
        </div>
        <div className="flex gap-2">
          <input
            className="input w-[200px]"
            placeholder="Search complaints…"
            value={query}
            onChange={e=>setQuery(e.target.value)}
          />
          <select className="input w-[160px]" value={status} onChange={e=>setStatus(e.target.value)}>
            <option>All</option>
            <option>Pending</option>
            <option>In Review</option>
            <option>Resolved</option>
          </select>
        </div>
      </div>

      <div className="card p-2">
        <div className="scrolly" style={{ maxHeight: 520 }}>
          <table className="table text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Email</th>
                <th>Type</th>
                <th>Message</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c=>(
                <tr key={c.id}>
                  <td className="text-white/60">{c.id}</td>
                  <td>{c.user}</td>
                  <td className="text-white/80">{c.email}</td>
                  <td><span className="chip">{c.type}</span></td>
                  <td className="max-w-[220px] truncate" title={c.message}>{c.message}</td>
                  <td>
                    <span className={`chip ${
                      c.status==='Resolved'?'bg-emerald-500/10 border-emerald-500/30 text-emerald-200':
                      c.status==='Pending'?'bg-yellow-500/10 border-yellow-500/30 text-yellow-100':
                      'bg-blue-500/10 border-blue-500/30 text-blue-200'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="text-white/60">{c.date}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn card px-3 py-1" onClick={()=>updateStatus(c.id,"In Review")}>Review</button>
                      <button className="btn btn-primary px-3 py-1" onClick={()=>updateStatus(c.id,"Resolved")}>Resolve</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
 */

const mockComplaints = [
  {
    id: 1,
    user: "Ali Raza",
    email: "ali@mail.com",
    date: "2025-09-10",
    message: "Driver cancelled the ride at the last moment."
  },
  {
    id: 2,
    user: "Ayesha Khan",
    email: "ayesha@mail.com",
    date: "2025-09-12",
    message: "Rider was late and rude."
  },
  {
    id: 3,
    user: "Zain Ahmed",
    email: "zain@mail.com",
    date: "2025-09-14",
    message: "The app charged me twice for one ride."
  }
];

function ComplaintsPage() {
  const [complaints, setComplaints] = useState(mockComplaints);

  const handleResolve = (id) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "Resolved" } : c
      )
    );
  };

  return (
    <div className="card">
      <h2 className="auth-title">User Complaints</h2>
      <p className="login-subtitle">
        Manage and resolve complaints submitted by riders and drivers
      </p>

      <div className="scrolly" style={{ maxHeight: "500px" }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Email</th>
              <th>Date</th>
              <th>Complaint</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.user}</td>
                <td>{c.email}</td>
                <td>{c.date}</td>
                <td style={{ maxWidth: "250px" }}>{c.message}</td>
                <td>
                  <span
                    className={`chip ${
                      c.status === "Resolved"
                        ? "bg-green"
                        : "bg-pending"
                    }`}
                  >
                    {c.status || "Pending"}
                  </span>
                </td>
                <td>
                  {c.status !== "Resolved" && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleResolve(c.id)}
                    >
                      Mark Resolved
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsPage(){
  return (
    <div className="card">
      <h2>Settings</h2>
      <div>Petrol Price: <input className="input" type="number" defaultValue={289} /></div>
    </div>
  )
}

/********************** Map **********************/
function MapBlock({ rides }){
  const center = rides.length ? { lat: rides[0].lat, lng: rides[0].lng } : { lat:24.86, lng:67.01 };
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: "YOUR_API_KEY" });

  if(!isLoaded) return <div>Loading Map…</div>;
  return (
    <GoogleMap mapContainerStyle={{ width:"100%", height:"300px" }} center={center} zoom={12}>
      {rides.map(r=> <Marker key={r.id} position={{ lat:r.lat, lng:r.lng }} /> )}
    </GoogleMap>
  );
}

/********************** Root **********************/
function Router(){
  return (
    <Routes>
      <Route path="/login" element={<LoginPage/>} />
      <Route path="/" element={<ProtectedRoute><AppShell><DashboardPage/></AppShell></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><AppShell><UsersPage/></AppShell></ProtectedRoute>} />
      <Route path="/verification" element={<ProtectedRoute><AppShell><VerificationPage/></AppShell></ProtectedRoute>} />
      <Route path="/rides" element={<ProtectedRoute><AppShell><RidesPage/></AppShell></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppShell><SettingsPage/></AppShell></ProtectedRoute>} />
      <Route path="/complaints" element={<ProtectedRoute><AppShell><ComplaintsPage/></AppShell></ProtectedRoute>} />

    </Routes>
  )
}

function Root(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </AuthProvider>
  )
}

createRoot(document.getElementById("root")).render(<Root />);
