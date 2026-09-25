"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate, formatDateTime, rwf } from "@/lib/format";
import { Empty, PageLoader } from "@/components/ui";

const PSTATUS: Record<string, string> = {
  successful: "bg-emerald-100 text-emerald-800",
  processing: "bg-sky-100 text-sky-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  settled: "bg-stone-200 text-stone-700",
};

export default function Payouts() {
  const { data, isLoading } = useQuery({ queryKey: ["seller-payouts"], queryFn: async () => (await api.get("/booking/api/seller/payouts")).data });
  if (isLoading || !data) return <PageLoader />;
  const next = data.readyForThursday.reduce((s: number, b: any) => s + b.providerAmount, 0);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Payouts</h1>
      <div className="card p-5">
        <p className="muted">Next Thursday payout</p>
        <p className="text-3xl font-bold">{rwf(next)}</p>
        <p className="mt-1 text-sm text-stone-600">Every Thursday HUZA pays everything released up to Wednesday 23:59, minus any confirmed fines. No minimum amount. HUZA pays the transfer fee.</p>
        {data.readyForThursday.length > 0 && (
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {data.readyForThursday.map((b: any) => <li key={b.id} className="flex justify-between py-2"><span>{b.serviceTitle} · {formatDate(b.eventDate)}</span><span>{rwf(b.providerAmount)}</span></li>)}
          </ul>
        )}
      </div>

      {data.onHold.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold">Not yet released</h2>
          <p className="muted">Upcoming, delivered-in-review, or disputed bookings.</p>
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {data.onHold.map((b: any) => (
              <li key={b.id} className="flex justify-between py-2">
                <span>{b.serviceTitle} · {formatDate(b.eventDate)} <span className="text-stone-500">({b.status}{b.releaseAt ? `, releases ${formatDateTime(b.releaseAt)}` : ""})</span></span>
                <span>{rwf(b.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="p-5 pb-2 font-semibold">Payout history</h2>
        {data.payouts.length === 0 ? <div className="p-5"><Empty title="No payouts yet" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500"><tr><th className="p-3">Thursday</th><th className="p-3">Earnings</th><th className="p-3">Fines deducted</th><th className="p-3">Sent</th><th className="p-3">To</th><th className="p-3">Status</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {data.payouts.map((p: any) => (
                <tr key={p.id}>
                  <td className="p-3">{formatDate(p.batchDate)}</td>
                  <td className="p-3">{rwf(p.gross)}</td>
                  <td className="p-3">{p.penaltyDeducted ? rwf(p.penaltyDeducted) : "—"}</td>
                  <td className="p-3 font-semibold">{rwf(p.amount)}</td>
                  <td className="p-3">{p.method === "momo" ? "MoMo" : p.method === "bank" ? "Bank" : "—"}</td>
                  <td className="p-3"><span className={`badge ${PSTATUS[p.status] || ""}`}>{p.status}</span>{p.failureReason && <span className="block text-xs text-red-600">{p.failureReason}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="p-5 pb-2 font-semibold">Ledger</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-stone-100">
            {data.ledger.map((l: any) => (
              <tr key={l.id}><td className="p-3 text-stone-500">{formatDateTime(l.createdAt)}</td><td className="p-3">{l.description}</td><td className={`p-3 text-right ${l.amount < 0 ? "text-red-600" : ""}`}>{rwf(l.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
