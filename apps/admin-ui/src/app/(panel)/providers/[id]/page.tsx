"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { formatDate, rwf } from "@/lib/format";
import { PageLoader } from "@/components/ui";
import { Pill, STATUS_COLORS, Table, Td } from "@/components/Table";

export default function ProviderDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-provider", id], queryFn: async () => (await api.get(`/admin/api/providers/${id}`)).data });
  const act = useMutation({
    mutationFn: async ({ path, body }: { path: string; body: any }) => api.post(`/admin/api/providers/${id}/${path}`, body),
    onSuccess: () => { toast.success("Done"); setNote(""); qc.invalidateQueries({ queryKey: ["admin-provider", id] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading || !data) return <PageLoader />;
  const p = data.provider;
  return (
    <div className="space-y-6">
      <Link href="/providers" className="text-sm text-stone-500">← Providers</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <Pill value={p.verificationStatus} map={STATUS_COLORS} />
        <Pill value={p.status} map={STATUS_COLORS} />
        {p.banRecommended && <span className="badge bg-red-600 text-white">ban recommended</span>}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-1 p-5 text-sm">
          <h2 className="mb-2 font-semibold">Account</h2>
          <p>Email: {p.email}</p>
          <p>Phone: {p.phone_number}</p>
          <p>Type: {p.accountType}</p>
          <p>Business: {p.shop?.name} ({p.shop?.category}, {p.shop?.district})</p>
          <p>Address: {p.shop?.address}</p>
          <p>Payout: {p.paymentMethod === "momo" ? `MoMo ${p.momoNetwork} ${p.momoPhoneNumber} (${p.momoName})` : p.paymentMethod === "bank" ? `${p.bankName} ${p.bankAccountNumber} (${p.bankAccountName})` : "not set"}</p>
          <p>Weddings delivered: {p.completedCount} · Active strikes: {p.activeStrikes} · Visibility {Math.round(p.visibilityScore)}</p>
          <p>Contact-detail violations: {p.contactViolations}</p>
          <p>Joined {formatDate(p.createdAt)}</p>
        </div>
        <div className="card space-y-3 p-5 text-sm">
          <h2 className="font-semibold">Verification</h2>
          <p>National ID number: <strong>{p.nationalIdNumber || "—"}</strong></p>
          {p.nationalIdDoc?.url && <a href={p.nationalIdDoc.url} target="_blank" rel="noreferrer" className="btn-outline py-1">Open national ID ↗</a>}
          {p.accountType === "company" && (
            <>
              <p>RDB code: <strong>{p.rdbNumber || "—"}</strong></p>
              {p.rdbCertificateDoc?.url && <a href={p.rdbCertificateDoc.url} target="_blank" rel="noreferrer" className="btn-outline py-1">Open RDB certificate ↗</a>}
            </>
          )}
          {p.verificationNote && <p className="text-stone-500">Last note: {p.verificationNote}</p>}
          <textarea className="input" rows={2} placeholder="Note (required when rejecting, shown to the provider)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={act.isPending} onClick={() => act.mutate({ path: "verify", body: { decision: "approve", note } })}>Approve</button>
            <button className="btn-outline" disabled={act.isPending} onClick={() => act.mutate({ path: "verify", body: { decision: "reject", note } })}>Reject</button>
          </div>
          <hr />
          <h2 className="font-semibold">Account status</h2>
          <div className="flex flex-wrap gap-2">
            {p.status !== "suspended" && p.status !== "banned" && <button className="btn-outline" onClick={() => act.mutate({ path: "status", body: { action: "suspend", note } })}>Suspend</button>}
            {(p.status === "suspended" || p.status === "banned") && <button className="btn-outline" onClick={() => act.mutate({ path: "status", body: { action: "reinstate", note } })}>Reinstate</button>}
            {p.status !== "banned" && <button className="btn-danger" onClick={() => confirm("Permanently ban this provider?") && act.mutate({ path: "status", body: { action: "ban", note } })}>Ban permanently</button>}
            {p.banRecommended && <button className="btn-ghost" onClick={() => act.mutate({ path: "status", body: { action: "dismiss_ban", note } })}>Dismiss ban recommendation</button>}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold">Strikes & fines</h2>
      <Table head={["Date", "Reason", "Amount", "Status"]}>
        {data.penalties.map((f: any) => <tr key={f.id}><Td>{formatDate(f.createdAt)}</Td><Td>{f.reason}</Td><Td>{rwf(f.amount)}</Td><Td><Pill value={f.status} map={STATUS_COLORS} /></Td></tr>)}
        {data.strikes.map((s: any) => <tr key={s.id}><Td>{formatDate(s.createdAt)}</Td><Td>Strike: {s.reason}</Td><Td>—</Td><Td>{s.active ? `active until ${formatDate(s.expiresAt)}` : "expired"}</Td></tr>)}
      </Table>

      <h2 className="text-lg font-semibold">Services</h2>
      <Table head={["Title", "Category", "Price", "Status"]}>
        {data.services.map((s: any) => <tr key={s.id}><Td>{s.title}</Td><Td>{s.category}</Td><Td>{rwf(s.basePrice)}</Td><Td><Pill value={s.isDeleted ? "deleted" : s.status} /></Td></tr>)}
      </Table>

      <h2 className="text-lg font-semibold">Recent bookings</h2>
      <Table head={["Event", "Service", "Price", "Status"]}>
        {data.bookings.map((b: any) => <tr key={b.id}><Td><Link href={`/bookings/${b.id}`} className="text-brand-700">{formatDate(b.eventDate)}</Link></Td><Td>{b.serviceTitle}</Td><Td>{rwf(b.price)}</Td><Td><Pill value={b.status} map={STATUS_COLORS} /></Td></tr>)}
      </Table>

      <h2 className="text-lg font-semibold">Payouts</h2>
      <Table head={["Thursday", "Gross", "Fines", "Sent", "Status"]}>
        {data.payouts.map((x: any) => <tr key={x.id}><Td>{x.batchDate}</Td><Td>{rwf(x.gross)}</Td><Td>{rwf(x.penaltyDeducted)}</Td><Td>{rwf(x.amount)}</Td><Td><Pill value={x.status} map={STATUS_COLORS} /></Td></tr>)}
      </Table>
    </div>
  );
}
