import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import Pagination from "../components/Pagination";
import { useAuth } from "../main"; // admin context

export default function VerificationPage() {
  const { user: admin } = useAuth();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState(""); // search by email
  const pageSize = 6;

  // reject modal
  const [rejectModal, setRejectModal] = useState({
    open: false,
    docId: null,
    reason: "",
  });

  // image preview modal
  const [preview, setPreview] = useState(null);

  const filters = useMemo(() => ({ status, q }), [status, q]);
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // ---------------- Fetch ----------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        let countQ = supabase
          .from("driver_documents")
          .select("*", { count: "exact", head: true });

        if (status !== "All") countQ = countQ.eq("status", status.toLowerCase());
        if (q.trim()) countQ = countQ.or(`email.ilike.%${q}%`);

        const { count, error: cErr } = await countQ;
        if (cErr) throw cErr;
        if (cancelled) return;
        setTotal(count || 0);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let dataQ = supabase
          .from("driver_documents")
          .select(
            `
            id,
            status,
            rejection_reason,
            license_url,
            car_plate_url,
            cnic_front_url,
            cnic_back_url,
            uploaded_at,
            user:users!driver_documents_user_id_fkey (
              id, email, role, status,
              profiles (phone, gender, profile_picture_url)
            ),
            reviewer:users!driver_documents_reviewed_by_fkey (
              id, email
            )
          `
          )
          .order("uploaded_at", { ascending: false })
          .range(from, to);

        if (status !== "All") dataQ = dataQ.eq("status", status.toLowerCase());
        if (q.trim()) dataQ = dataQ.or(`email.ilike.%${q}%`);

        const { data, error } = await dataQ;
        if (error) throw error;
        if (cancelled) return;

        // ✅ Convert storage paths to public URLs
        const bucket = supabase.storage.from("driver_docs");
        const toPublicUrl = (path) =>
          path ? bucket.getPublicUrl(path).data.publicUrl : null;

        const withUrls = (data || []).map((row) => ({
          ...row,
          license_url: toPublicUrl(row.license_url),
          car_plate_url: toPublicUrl(row.car_plate_url),
          cnic_front_url: toPublicUrl(row.cnic_front_url),
          cnic_back_url: toPublicUrl(row.cnic_back_url),
        }));

        setRows(withUrls);
      } catch (e) {
        if (!cancelled)
          setErr(e.message || "Failed to load verification requests");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, filters]);

  // ---------------- Actions ----------------
  const updateDocStatus = async (docId, newStatus, rejection_reason = null) => {
    try {
      const { error } = await supabase
        .from("driver_documents")
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: admin?.id || null,
          rejection_reason,
        })
        .eq("id", docId);
      if (error) throw error;
      setRows(
        rows.map((r) =>
          r.id === docId
            ? {
                ...r,
                status: newStatus,
                rejection_reason,
                reviewer: { email: admin?.email },
              }
            : r
        )
      );
    } catch (e) {
      alert("Update failed: " + (e.message || "Unexpected error"));
    }
  };

  const handleRejectConfirm = () => {
    if (!rejectModal.reason.trim()) {
      alert("Please enter a reason before rejecting.");
      return;
    }
    updateDocStatus(rejectModal.docId, "rejected", rejectModal.reason.trim());
    setRejectModal({ open: false, docId: null, reason: "" });
  };

  // ---------------- Modal Gallery ----------------
  const openPreview = (urls, i = 0) => setPreview({ urls, index: i });
  const closePreview = () => setPreview(null);
  const nextImg = () =>
    setPreview((p) => ({ ...p, index: (p.index + 1) % p.urls.length }));
  const prevImg = () =>
    setPreview((p) => ({
      ...p,
      index: (p.index - 1 + p.urls.length) % p.urls.length,
    }));

  const handleKey = useCallback(
    (e) => {
      if (!preview) return;
      if (e.key === "Escape") closePreview();
      if (e.key === "ArrowRight") nextImg();
      if (e.key === "ArrowLeft") prevImg();
    },
    [preview]
  );

  useEffect(() => {
    if (preview) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [preview, handleKey]);

  const statusLabels = {
    pending: "⏳ Pending Approval",
    approved: "✅ Approved",
    rejected: "❌ Rejected",
  };

  // ---------------- Render ----------------
  return (
    <div>
      {/* Image Preview Modal */}
      {preview && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <img
              src={preview.urls[preview.index]}
              alt="Full doc"
              className="modal-img"
            />
            <div className="gallery-nav">
              <button onClick={prevImg}>← Prev</button>
              <button onClick={nextImg}>Next →</button>
            </div>
            <button className="btn btn-secondary" onClick={closePreview}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal.open && (
        <div
          className="modal-overlay"
          onClick={() =>
            setRejectModal({ open: false, docId: null, reason: "" })
          }
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Verification</h3>
            <textarea
              className="input"
              rows={4}
              placeholder="Enter reason for rejection (will be shown to carpooler)"
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal({ ...rejectModal, reason: e.target.value })
              }
            />
            <div className="action-buttons">
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setRejectModal({ open: false, docId: null, reason: "" })
                }
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleRejectConfirm}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <h2>Verification Requests</h2>
        <div className="filters">
          <div className="filter-group">
            <label>Search</label>
            <input
              className="input"
              placeholder="Search by email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>All</option>
              <option>pending</option>
              <option>approved</option>
              <option>rejected</option>
            </select>
          </div>
        </div>
      </div>

      {err && <div className="error-text">{err}</div>}
      {loading && <div>Loading…</div>}
      {!loading && rows.length === 0 && <div>No verification requests 🎉</div>}

      <div className="grid verify-grid">
        {rows.map((v) => {
          const docUrls = [
            v.license_url,
            v.car_plate_url,
            v.cnic_front_url,
            v.cnic_back_url,
          ].filter(Boolean);
          const docLabels = [
            "Driver License",
            "Car Plate",
            "CNIC Front",
            "CNIC Back",
          ];
          return (
            <div className="card verify-card" key={v.id}>
              {/* User Info */}
              <div className="verify-header">
                <img
                  src={v.user?.profiles?.profile_picture_url || "/avatar.png"}
                  alt="avatar"
                  className="avatar"
                />
                <div>
                  <div className="brand-text">
                    {v.user?.email || "Unknown user"}
                  </div>
                  <div className="text-sm muted">
                    Role: {v.user?.role}, Status: {v.user?.status}
                  </div>
                </div>
              </div>

              {/* Docs */}
              <div className="docs-grid">
                {docUrls.map((url, i) => (
                  <div className="doc-box" key={i}>
                    <img src={url} alt={docLabels[i]} className="doc-thumb" />
                    <button
                      className="btn-sm btn-secondary view-btn"
                      onClick={() => openPreview(docUrls, i)}
                    >
                      View {docLabels[i]}
                    </button>
                  </div>
                ))}
              </div>

              {/* Status + Reviewer */}
              <div className="status-row">
                <span className={`badge status-${v.status}`}>
                  {statusLabels[v.status] || v.status}
                </span>
                <span className="text-sm muted">
                  {new Date(v.uploaded_at).toLocaleString()}
                </span>
              </div>
              {v.rejection_reason && (
                <div className="reject-notes">
                  <strong>Reason:</strong> {v.rejection_reason}
                </div>
              )}
              {v.reviewer && (
                <div className="text-sm muted">
                  Reviewed by {v.reviewer.email}
                </div>
              )}

              {/* Actions */}
              {v.status === "pending" && (
                <div className="action-buttons">
                  <button
                    className="btn-sm btn-success"
                    onClick={() => updateDocStatus(v.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn-sm btn-danger"
                    onClick={() =>
                      setRejectModal({ open: true, docId: v.id, reason: "" })
                    }
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPage={setPage}
      />
    </div>
  );
}
