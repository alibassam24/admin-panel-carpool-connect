// pages/ForgotPasswordPage.jsx
import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "../hooks/useRealtime";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!email.trim()) {
      setErr("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // page Supabase will send them back to
      });
      if (error) throw error;
      setMsg("Password reset link has been sent to your email.");
    } catch (e) {
      setErr(e.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <form className="login-box card card-lg" onSubmit={submit}>
        <div className="login-header">
          <h1 className="auth-title">Forgot Password</h1>
        </div>
        <p className="login-subtitle">
          Enter your admin email and we’ll send you a reset link.
        </p>

        <label>Email</label>
        <input
          className="input"
          type="email"
          placeholder="admin@carpool.app"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {err && <div className="error-text">{err}</div>}
        {msg && <div className="success-text">{msg}</div>}

        <button
          type="submit"
          className="btn btn-primary login-btn"
          disabled={loading}
        >
          {loading ? "Sending…" : "Send Reset Link"}
        </button>

        <div className="forgot-link">
          <a href="#" onClick={() => nav("/login")}>
            Back to Login
          </a>
        </div>
      </form>
    </div>
  );
}
