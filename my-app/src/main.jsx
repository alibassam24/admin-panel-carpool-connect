import React, { createContext, useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { supabase } from "./lib/supabase";

/* Pages */
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import RidesPage from "./pages/RidesPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import VerificationPage from "./pages/VerificationPage";
import SettingsPage from "./pages/SettingsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

import "./styles.css";

/* ---------- Theme ---------- */
const ThemeCtx = createContext();
const useTheme = () => useContext(ThemeCtx);

function ThemeProvider({ children }) {
  const [dark, setDark] = useState(
    () => localStorage.getItem("cc_theme") === "dark"
  );
  const toggle = () =>
    setDark((d) => {
      const next = !d;
      localStorage.setItem("cc_theme", next ? "dark" : "light");
      return next;
    });
  return (
    <ThemeCtx.Provider value={{ dark, toggle }}>
      <div className={dark ? "theme-dark" : "theme-light"}>{children}</div>
    </ThemeCtx.Provider>
  );
}

/* ---------- Auth ---------- */
const AuthCtx = createContext();
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (u) => {
    if (!u) return null;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", u.id)
        .maybeSingle();
      if (error) return null;
      return data?.role;
    } catch {
      return null;
    }
  };

  const timeout = (ms) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    );

  const fetchRoleWithTimeout = async (u) => {
    return Promise.race([fetchRole(u), timeout(4000)]);
  };

  useEffect(() => {
    let active = true;
    async function init() {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;

      const u = session?.user || null;
      if (u) {
        setUser(u);
        fetchRoleWithTimeout(u).then((role) => {
          if (role?.toLowerCase() !== "admin") {
            supabase.auth.signOut();
            setUser(null);
          }
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, session) => {
      const u = session?.user || null;
      if (u) {
        setUser(u);
        fetchRoleWithTimeout(u).then((role) => {
          if (role?.toLowerCase() !== "admin") {
            supabase.auth.signOut();
            setUser(null);
          }
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        throw new Error("Wrong email or password.");
      }
      throw error;
    }
    const u = data?.user;
    if (!u) throw new Error("No user returned from Supabase.");

    const role = await fetchRoleWithTimeout(u);
    if (role?.toLowerCase() !== "admin") {
      await supabase.auth.signOut();
      throw new Error("You are not authorized as admin.");
    }
    setUser(u);
    return u;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="loading-screen">⏳ Connecting…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

/* ---------- Layout ---------- */
function Topbar({ onMenu }) {
  const { logout, user } = useAuth();
  const { toggle } = useTheme();
  return (
    <div className="topbar container flex-between">
      <button className="hamburger" onClick={onMenu} aria-label="Menu">
        ☰
      </button>
      <div className="brand-text">Carpool Connect — Admin</div>
      <div className="flex-center gap-md">
        <button className="btn btn-secondary" onClick={toggle}>
          🌗
        </button>
        <span className="user-email">{user?.email}</span>
        <button className="btn btn-primary btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }) {
  const linkCls = ({ isActive }) =>
    `sidebar-link ${isActive ? "active-link" : ""}`;
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <NavLink className={linkCls} to="/" end onClick={onClose}>
        Dashboard
      </NavLink>
      <NavLink className={linkCls} to="/users" onClick={onClose}>
        Users
      </NavLink>
      <NavLink className={linkCls} to="/rides" onClick={onClose}>
        Rides
      </NavLink>
      <NavLink className={linkCls} to="/complaints" onClick={onClose}>
        Complaints
      </NavLink>
      <NavLink className={linkCls} to="/verification" onClick={onClose}>
        Verification
      </NavLink>
      <NavLink className={linkCls} to="/settings" onClick={onClose}>
        Settings
      </NavLink>
    </aside>
  );
}

function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <Topbar onMenu={() => setOpen((o) => !o)} />
      <div className="shell-main">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}

/* ---------- Login ---------- */
export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!email || !pass) {
      setErr("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const u = await login(email, pass);
      if (u) nav(from, { replace: true });
    } catch (error) {
      setErr(error?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <form className="login-box card card-lg" onSubmit={submit}>
        <div className="login-header">
          <h1 className="auth-title">Carpool Connect Admin</h1>
        </div>
        <p className="login-subtitle">
          Admins only. Use your Supabase email/password.
        </p>

        <label>Email</label>
        <input
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@carpool.app"
        />

        <label>Password</label>
        <input
          className="input"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••••••"
        />

        {err && <div className="error-text">{err}</div>}

        <button
          type="submit"
          className="btn btn-primary login-btn"
          disabled={loading}
        >
          {loading ? "Logging in…" : "Login"}
        </button>

        <div className="forgot-link">
          <a onClick={() => nav("/forgot-password")}>Forgot Password?</a>
        </div>
      </form>
    </div>
  );
}

/* ---------- Routes ---------- */
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <AppShell>
              <UsersPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rides"
        element={
          <ProtectedRoute>
            <AppShell>
              <RidesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/complaints"
        element={
          <ProtectedRoute>
            <AppShell>
              <ComplaintsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/verification"
        element={
          <ProtectedRoute>
            <AppShell>
              <VerificationPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppShell>
              <SettingsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/* ---------- Bootstrap ---------- */
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);
