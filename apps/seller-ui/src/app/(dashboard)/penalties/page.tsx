"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { fileToDataUrl, formatDate, rwf } from "@/lib/format";
import { Empty, Modal, PageLoader } from "@/components/ui";

const FSTATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  appealed: "bg-sky-100 text-sky-800",
  waived: "bg-emerald-100 text-emerald-800",
  confirmed: "bg-red-100 text-red-800",
  deducted: "bg-stone-200 text-stone-700",
};

export default function Penalties() {
  const qc = useQueryClient();
  const [appealing, setAppealing] = useState<any>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const { data, isLoading } = useQuery({ queryKey: ["seller-penalties"], queryFn: async () => (await api.get("/booking/api/seller/penalties")).data });
  const appeal = useMutation({
    mutationFn: async () => api.post(`/booking/api/seller/penalties/${appealing.id}/appeal`, { text, evidence: files }),
    onSuccess: () => { toast.success("Appeal submitted — an admin will review it"); setAppealing(null); setText(""); setFiles([]); qc.invalidateQueries({ queryKey: ["seller-penalties"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading || !data) return <PageLoader />;
  const active = data.strikes.filter((s: any) => s.active).length;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fines & strikes</h1>
      <div className="card p-5 text-sm">
        <p className="text-3xl font-bold">{active} <span className="text-base font-normal text-stone-500">active strike(s)</span></p>
        <ul className="mt-3 space-y-1 text-stone-700">
          <li>• Strikes last {data.rules.windowMonths} months.</li>
          <li>• 1 strike: warning · 2: lower placement in search · 3: suspended (listings hidden, no new bookings) · 4+: permanent ban reviewed by HUZA.</li>
          <li>• Cancellation fines: 10% (30+ days' notice), 20% (7–29 days), 30% (under 7 days), 50% for a no-show. Fines are deducted from your Thursday payouts.</li>
          <li>• Real emergencies with evidence (medical note, police report…) are waived with no strike.</li>
        </ul>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="p-5 pb-2 font-semibold">Fines</h2>
        {data.penalties.length === 0 ? <div className="p-5"><Empty title="No fines — keep it up!" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500"><tr><th className="p-3">Date</th><th className="p-3">Reason</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {data.penalties.map((p: any) => (
                <tr key={p.id}>
                  <td className="p-3">{formatDate(p.createdAt)}</td>
                  <td className="p-3">{p.reason}{p.decisionNote && <span className="block text-xs text-stone-500">{p.decisionNote}</span>}</td>
                  <td className="p-3">{rwf(p.amount)}{p.deductedAmount > 0 && <span className="block text-xs text-stone-500">{rwf(p.deductedAmount)} deducted</span>}</td>
                  <td className="p-3"><span className={`badge ${FSTATUS[p.status]}`}>{p.status}</span></td>
                  <td className="p-3 text-right">{p.status === "pending" && new Date(p.appealDeadline) > new Date() && <button className="btn-outline py-1" onClick={() => setAppealing(p)}>Appeal (until {formatDate(p.appealDeadline)})</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">Strike history</h2>
        {data.strikes.length === 0 ? <p className="muted mt-2">No strikes.</p> : (
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {data.strikes.map((s: any) => <li key={s.id} className="flex justify-between py-2"><span>{s.reason}</span><span className={s.active ? "text-red-600" : "text-stone-400"}>{s.active ? `active until ${formatDate(s.expiresAt)}` : "expired"}</span></li>)}
          </ul>
        )}
      </div>

      <Modal open={!!appealing} onClose={() => setAppealing(null)} title="Appeal this fine">
        <div className="space-y-3 text-sm">
          <p>{appealing?.reason} — {rwf(appealing?.amount || 0)}</p>
          <textarea className="input" rows={4} placeholder="Explain the emergency (at least 30 characters)" value={text} onChange={(e) => setText(e.target.value)} />
          <div>
            <label className="label">Evidence (required, up to 5 files)</label>
            <input type="file" multiple accept="image/*,application/pdf" onChange={async (e) => setFiles(await Promise.all(Array.from(e.target.files || []).slice(0, 5).map(fileToDataUrl)))} />
          </div>
          <button className="btn-primary w-full" disabled={appeal.isPending || text.length < 30 || files.length === 0} onClick={() => appeal.mutate()}>Submit appeal</button>
        </div>
      </Modal>
    </div>
  );
}
