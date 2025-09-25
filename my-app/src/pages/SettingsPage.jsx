import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRealtime } from "../hooks/useRealtime";
export default function SettingsPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [savingKey, setSavingKey] = useState(null);

  // fetch all settings rows
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        setSuccess("");
        const { data, error } = await supabase
          .from("settings")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (!cancelled) setRows(data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load settings");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useRealtime("settings", fetchSettings);
  const update = async (row, newValue) => {
    setSavingKey(row.key);
    setErr("");
    setSuccess("");
    try {
      const { error } = await supabase
        .from("settings")
        .update({ value: newValue })
        .eq("id", row.id);
      if (error) throw error;

      setRows((rows) =>
        rows.map((r) =>
          r.id === row.id
            ? { ...r, value: newValue, updated_at: new Date().toISOString() }
            : r
        )
      );
      setSuccess(`✅ Updated setting "${row.key}"`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setErr(e.message || "Failed to update setting");
    } finally {
      setSavingKey(null);
    }
  };

  if (err) return <div className="error-text">{err}</div>;
  if (!rows.length) return <div>No settings found.</div>;

  return (
    <div className="card">
      <h2 className="settings-title">⚙️ Settings</h2>

      {success && <div className="success-text">{success}</div>}
      {err && <div className="error-text">{err}</div>}

      <div className="settings-grid">
        {rows.map((row) => (
          <div className="setting-block" key={row.id}>
            <label className="setting-label">{row.key}</label>
            <div className="setting-input-row">
              <input
                className="input flex-grow"
                type="text"
                value={row.value ?? ""}
                onChange={(e) =>
                  setRows((rows) =>
                    rows.map((r) =>
                      r.id === row.id ? { ...r, value: e.target.value } : r
                    )
                  )
                }
              />
              <button
                className="btn btn-primary save-btn"
                disabled={savingKey === row.key}
                onClick={() => update(row, row.value)}
              >
                {savingKey === row.key ? "Saving…" : "Save"}
              </button>
            </div>
            <div className="text-sm muted">
              Last updated:{" "}
              {row.updated_at
                ? new Date(row.updated_at).toLocaleString()
                : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
