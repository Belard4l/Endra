"use client";
import React, { useEffect } from "react";
import { Loader2, ShieldCheck, Star, X } from "lucide-react";

export const Spinner = ({ className = "" }: { className?: string }) => <Loader2 className={`h-5 w-5 animate-spin ${className}`} />;

export const PageLoader = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-stone-500">
    <Spinner />
  </div>
);

export const Stars = ({ value, count, size = 14 }: { value: number; count?: number; size?: number }) => (
  <span className="inline-flex items-center gap-1 text-sm text-stone-600">
    <Star size={size} className={value > 0 ? "fill-amber-400 text-amber-400" : "text-stone-300"} />
    {value > 0 ? value.toFixed(1) : "New"}
    {count !== undefined && count > 0 && <span className="text-stone-400">({count})</span>}
  </span>
);

export const StarInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
        <Star size={28} className={n <= value ? "fill-amber-400 text-amber-400" : "text-stone-300"} />
      </button>
    ))}
  </div>
);

export const Empty = ({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) => (
  <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
    <p className="text-lg font-semibold">{title}</p>
    {text && <p className="max-w-md text-sm text-stone-500">{text}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;

export const Modal = ({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-stone-100" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const SafetyNotice = ({ compact }: { compact?: boolean }) => (
  <div className={`flex gap-3 rounded-xl border border-brand-100 bg-brand-50 text-brand-900 ${compact ? "p-3 text-sm" : "p-4"}`}>
    <ShieldCheck className="mt-0.5 shrink-0 text-brand-700" size={compact ? 18 : 22} />
    <div>
      <p className="font-semibold">Book on HUZA to stay protected</p>
      <p className={compact ? "text-xs" : "text-sm"}>
        Bookings made outside HUZA have no payment protection, no refunds and no replacement if a provider cancels.
      </p>
    </div>
  </div>
);

export const Pagination = ({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) =>
  pages > 1 ? (
    <div className="mt-8 flex items-center justify-center gap-2">
      <button className="btn-outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span className="text-sm text-stone-600">
        Page {page} of {pages}
      </span>
      <button className="btn-outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  ) : null;

export const StatusBadge = ({ status, map }: { status: string; map: Record<string, { label: string; className: string }> }) => {
  const s = map[status] || { label: status, className: "bg-stone-100 text-stone-700" };
  return <span className={`badge ${s.className}`}>{s.label}</span>;
};
