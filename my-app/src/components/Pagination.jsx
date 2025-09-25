import React from "react";

export default function Pagination({ page, total, pageSize, onPage }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="pagination">
      <button disabled={!canPrev} onClick={() => onPage(page - 1)}>Prev</button>
      <span>Page {page} of {totalPages}</span>
      <button disabled={!canNext} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}
