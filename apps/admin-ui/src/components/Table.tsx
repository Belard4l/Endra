"use client";
import React from "react";

export const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => (
  <div className="card overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-stone-50 text-left text-stone-500">
        <tr>{head.map((h) => <th key={h} className="whitespace-nowrap p-3 font-medium">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-stone-100">{children}</tbody>
    </table>
  </div>
);

export const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <td className={`p-3 align-top ${className}`}>{children}</td>;

export const Pill = ({ value, map }: { value: string; map?: Record<string, string> }) => (
  <span className={`badge ${map?.[value] || "bg-stone-100 text-stone-700"}`}>{value.replace(/_/g, " ")}</span>
);

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  approved: "bg-emerald-100 text-emerald-800",
  successful: "bg-emerald-100 text-emerald-800",
  released: "bg-emerald-100 text-emerald-800",
  confirmed: "bg-sky-100 text-sky-800",
  completed: "bg-sky-100 text-sky-800",
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-sky-100 text-sky-800",
  appealed: "bg-violet-100 text-violet-800",
  open: "bg-orange-100 text-orange-800",
  disputed: "bg-orange-100 text-orange-800",
  restricted: "bg-amber-100 text-amber-800",
  unsubmitted: "bg-stone-200 text-stone-700",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
  banned: "bg-red-600 text-white",
  failed: "bg-red-100 text-red-800",
  waived: "bg-emerald-100 text-emerald-800",
  deducted: "bg-stone-200 text-stone-700",
  cancelled_by_provider: "bg-red-100 text-red-800",
  cancelled_by_couple: "bg-stone-200 text-stone-700",
};

export const downloadCsv = async (path: string, filename: string, api: any) => {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
