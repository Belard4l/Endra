"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, rwf } from "@/lib/format";
import { Empty, PageLoader } from "@/components/ui";
import { Pill, STATUS_COLORS } from "@/components/Table";

const LABELS: Record<string, string> = {
  late_arrival: "Arrived significantly late",
  minor_missing: "Some agreed items missing",
  major_missing: "Major agreed items missing",
  poor_quality: "Quality far below listing",
  no_show: "Provider did not show up",
  other: "Other",
};

export default function Disputes() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const [pct, setPct] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({ queryKey: ["admin-disputes", status], queryFn: async () => (await api.get(`/admin/api/disputes?status=${status}`)).data.disputes as any[] });
  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "accept" | "reject" }) => api.post(`/admin/api/disputes/${id}/decide`, { decision, refundPercent: pct[id], note: notes[id] }),
    onSuccess: () => { toast.success("Dispute resolved — refund and payout processed"); qc.invalidateQueries({ queryKey: ["admin-disputes"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Disputes</h1>
      <p className="muted">Preset partial refunds apply to the service amount paid. Review evidence from both sides, adjust if needed, then confirm. No-show confirmations become a provider cancellation with a full refund and a 50% fine.</p>
      <div className="flex gap-2">{["open", "resolved", "rejected", "all"].map((s) => <button key={s} className={status === s ? "btn-dark" : "btn-outline"} onClick={() => setStatus(s)}>{s}</button>)}</div>
      {isLoading ? <PageLoader /> : !data?.length ? <Empty title="No disputes" /> : data.map((d) => {
        const b = d.booking;
        const value = pct[d.id] ?? d.proposedRefundPercent;
        const servicePaid = b ? Math.max(0, b.amountPaid - Math.min(b.amountPaid, b.bookingFee)) : 0;
        return (
          <div key={d.id} className="card space-y-3 p-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{LABELS[d.problemType] || d.problemType}</p>
              <Pill value={d.status} map={STATUS_COLORS} />
            </div>
            {b && <p><Link className="text-brand-700" href={`/bookings/${b.id}`}>{b.serviceTitle}</Link> · {formatDate(b.eventDate)} · service paid {rwf(servicePaid)}</p>}
            <p className="rounded-lg bg-stone-50 p-3"><span className="font-medium">Couple:</span> {d.description}</p>
            {d.providerResponse ? <p className="rounded-lg bg-stone-50 p-3"><span className="font-medium">Provider:</span> {d.providerResponse}</p> : <p className="text-stone-500">No provider response yet.</p>}
            {d.evidence.length > 0 && <p>{d.evidence.map((f: any, i: number) => <a key={i} href={f.url} target="_blank" rel="noreferrer" className="mr-3 text-brand-700 underline">Evidence {i + 1}</a>)}</p>}
            <p className="text-xs text-stone-400">Opened {formatDateTime(d.createdAt)}</p>
            {d.status === "open" ? (
              <div className="flex flex-wrap items-end gap-3 border-t border-stone-100 pt-3">
                {d.problemType !== "no_show" && (
                  <div>
                    <label className="label">Refund %</label>
                    <input type="number" min={0} max={100} className="input w-24" value={value} onChange={(e) => setPct({ ...pct, [d.id]: Number(e.target.value) })} />
                    <p className="mt-1 text-xs">= {rwf((servicePaid * value) / 100)}</p>
                  </div>
                )}
                <input className="input flex-1" placeholder="Note to both parties" value={notes[d.id] || ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} />
                <button className="btn-primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: d.id, decision: "accept" })}>{d.problemType === "no_show" ? "Confirm no-show" : "Confirm refund"}</button>
                <button className="btn-outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: d.id, decision: "reject" })}>Reject (pay provider)</button>
              </div>
            ) : (
              <p>Outcome: {d.resolvedRefundPercent}% refund{d.adminNote ? ` — ${d.adminNote}` : ""}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
