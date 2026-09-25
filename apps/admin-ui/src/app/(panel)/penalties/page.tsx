"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { formatDate, rwf } from "@/lib/format";
import { Empty, PageLoader } from "@/components/ui";
import { Pill, STATUS_COLORS } from "@/components/Table";

export default function Penalties() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("appealed");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({ queryKey: ["admin-penalties", status], queryFn: async () => (await api.get(`/admin/api/penalties?status=${status}`)).data.penalties as any[] });
  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "waive" | "confirm" }) => api.post(`/admin/api/penalties/${id}/decide`, { decision, note: notes[id] }),
    onSuccess: () => { toast.success("Decision saved"); qc.invalidateQueries({ queryKey: ["admin-penalties"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Fines & appeals</h1>
      <p className="muted">Waive when the provider shows full, compelling evidence of an emergency (no fine, no strike). Confirming adds a strike and the fine is deducted from future Thursday payouts. Unappealed fines are confirmed automatically when the appeal window closes.</p>
      <div className="flex flex-wrap gap-2">{["appealed", "pending", "confirmed", "waived", "deducted", "all"].map((s) => <button key={s} className={status === s ? "btn-dark" : "btn-outline"} onClick={() => setStatus(s)}>{s}</button>)}</div>
      {isLoading ? <PageLoader /> : !data?.length ? <Empty title="Nothing here" /> : data.map((p) => (
        <div key={p.id} className="card space-y-2 p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold"><Link href={`/providers/${p.sellerId}`} className="text-brand-700">{p.seller?.name}</Link> · {rwf(p.amount)} · {p.seller?.activeStrikes} active strike(s)</p>
            <Pill value={p.status} map={STATUS_COLORS} />
          </div>
          <p>{p.reason}</p>
          {p.cancellation && <p className="text-stone-600">Cancellation reason: {p.cancellation.reasonCategory}{p.cancellation.reason ? ` — ${p.cancellation.reason}` : ""} {p.cancellation.evidence.map((f: any, i: number) => <a key={i} href={f.url} target="_blank" rel="noreferrer" className="ml-2 text-brand-700 underline">file {i + 1}</a>)}</p>}
          {p.appealText && <p className="rounded-lg bg-violet-50 p-3"><span className="font-medium">Appeal:</span> {p.appealText}</p>}
          {p.appealEvidence.length > 0 && <p>{p.appealEvidence.map((f: any, i: number) => <a key={i} href={f.url} target="_blank" rel="noreferrer" className="mr-3 text-brand-700 underline">Appeal evidence {i + 1}</a>)}</p>}
          <p className="text-xs text-stone-400">Created {formatDate(p.createdAt)} · appeal deadline {formatDate(p.appealDeadline)}</p>
          {["pending", "appealed"].includes(p.status) && (
            <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
              <input className="input flex-1" placeholder="Decision note (sent to the provider)" value={notes[p.id] || ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
              <button className="btn-primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, decision: "waive" })}>Waive (emergency)</button>
              <button className="btn-danger" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, decision: "confirm" })}>Confirm fine + strike</button>
            </div>
          )}
          {p.decisionNote && <p className="text-stone-500">Decision: {p.decisionNote}</p>}
        </div>
      ))}
    </div>
  );
}
