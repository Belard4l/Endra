"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CalendarDays, Clock, Lock, MapPin, Phone, Send } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { PROVIDER_STATUS_LABELS, fileToDataUrl, formatDate, formatDateTime, rwf } from "@/lib/format";
import { Modal, PageLoader, Spinner, StatusBadge } from "@/components/ui";

const REASONS: Record<string, string> = {
  emergency: "Emergency",
  illness: "Illness / medical",
  schedule_conflict: "Schedule conflict",
  equipment_failure: "Equipment failure",
  other: "Other",
};

const Chat = ({ id }: { id: string }) => {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const { data } = useQuery({ queryKey: ["messages", id], queryFn: async () => (await api.get(`/booking/api/seller/bookings/${id}/messages`)).data, refetchInterval: 8000 });
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [data?.messages?.length]);
  const send = useMutation({
    mutationFn: async () => api.post(`/booking/api/seller/bookings/${id}/messages`, { text }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["messages", id] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="card p-5">
      <h3 className="font-semibold">Wedding-day chat</h3>
      <div className="mt-3 h-64 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-3">
        {(data?.messages || []).map((m: any) => (
          <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.senderType === "seller" ? "ml-auto bg-brand-700 text-white" : "bg-white"}`}>
            {m.text}
            <div className="mt-0.5 text-[10px] opacity-70">{formatDateTime(m.createdAt)}</div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }}>
        <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the couple…" />
        <button className="btn-primary" disabled={send.isPending}><Send size={16} /></button>
      </form>
    </div>
  );
};

export default function SellerBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState("emergency");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [response, setResponse] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["seller-booking", id], queryFn: async () => (await api.get(`/booking/api/seller/bookings/${id}`)).data });
  const act = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: any }) => (await api.post(`/booking/api/seller/bookings/${id}/${path}`, body || {})).data,
    onSuccess: (r, v) => {
      toast.success(r?.message || (v.path === "complete" ? "Marked as delivered. The couple has a short window to confirm or report a problem." : "Done"));
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ["seller-booking", id] });
      qc.invalidateQueries({ queryKey: ["seller-bookings"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading || !data) return <PageLoader />;
  const b = data.booking;
  return (
    <div className="space-y-6">
      <Link href="/bookings" className="text-sm text-stone-500">← Bookings</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{b.serviceTitle}</h1>
        <StatusBadge status={b.status} map={PROVIDER_STATUS_LABELS} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="card space-y-3 p-5 text-sm">
            <p className="flex items-center gap-2"><CalendarDays size={16} /> {formatDate(b.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="flex items-center gap-2"><Clock size={16} /> {b.startTime}{b.endTime ? ` – ${b.endTime}` : ""}</p>
            {b.locationRevealed ? (
              <p className="flex items-center gap-2"><MapPin size={16} /> {b.eventLocation}, {b.eventDistrict}</p>
            ) : (
              <p className="flex items-center gap-2 text-stone-600"><Lock size={16} /> {b.eventDistrict} — the exact venue is shown about 2 weeks before the event, once the couple has paid in full.</p>
            )}
            <p>Couple: <strong>{data.couple.firstName}</strong>{data.couple.phone && <span className="ml-2 inline-flex items-center gap-1 text-emerald-700"><Phone size={14} /> {data.couple.phone} (today)</span>}</p>
            {b.selectedOptions.length > 0 && (
              <ul className="list-inside list-disc text-stone-700">{b.selectedOptions.map((o: any) => <li key={o.choiceId}>{o.groupName}: {o.label}</li>)}</ul>
            )}
            {b.notes && <p className="text-stone-700">Notes: {b.notes}</p>}
          </div>

          {data.chatOpen && <Chat id={b.id} />}

          {data.dispute && (
            <div className="card space-y-2 p-5 text-sm">
              <h2 className="font-semibold">Problem reported by the couple</h2>
              <p>{data.dispute.description}</p>
              <p className="text-stone-500">Status: {data.dispute.status}{data.dispute.resolvedRefundPercent !== null && data.dispute.resolvedRefundPercent !== undefined ? ` · ${data.dispute.resolvedRefundPercent}% refunded` : ""}</p>
              {data.dispute.status === "open" && (
                data.dispute.providerResponse ? <p className="rounded bg-stone-50 p-3">Your response: {data.dispute.providerResponse}</p> : (
                  <>
                    <textarea className="input" rows={3} placeholder="Your side of the story (HUZA reviews both)" value={response} onChange={(e) => setResponse(e.target.value)} />
                    <button className="btn-outline" disabled={act.isPending} onClick={() => act.mutate({ path: "dispute-response", body: { response } })}>Send response</button>
                  </>
                )
              )}
            </div>
          )}

          {data.penalty && (
            <div className="card p-5 text-sm">
              <h2 className="font-semibold">Cancellation fine</h2>
              <p className="mt-1">{rwf(data.penalty.amount)} — {data.penalty.status}. <Link href="/penalties" className="text-brand-700 underline">Appeal or view details</Link></p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Money</h2>
            <div className="flex justify-between py-1"><span className="text-stone-600">Booking price</span><span>{rwf(b.price)}</span></div>
            <div className="flex justify-between py-1"><span className="text-stone-600">Couple has paid</span><span>{b.paymentStatus === "paid" ? "In full" : b.paymentStatus === "deposit_paid" ? "Deposit" : b.paymentStatus.replace("_", " ")}</span></div>
            {b.releasedAt ? (
              <div className="flex justify-between py-1 font-semibold"><span>Your earnings</span><span>{rwf(b.providerAmount)}</span></div>
            ) : (
              <p className="mt-2 text-xs text-stone-500">You'll receive about 85% of the price after processing fees, on the Thursday after the couple's review window closes.</p>
            )}
          </div>
          {data.canComplete && (
            <button className="btn-primary w-full" disabled={act.isPending} onClick={() => act.mutate({ path: "complete" })}>Mark as delivered</button>
          )}
          {b.status === "confirmed" && (
            <button className="btn-outline w-full text-red-600" onClick={() => setCancelOpen(true)}>I can't make it — cancel</button>
          )}
        </aside>
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this booking?">
        <div className="space-y-3 text-sm">
          <p className="rounded-lg bg-red-50 p-3 text-red-900">
            The couple will be refunded or offered a replacement. A fine of <strong>{data.cancelFinePercent}%</strong> of the booking ({rwf((b.price * (data.cancelFinePercent || 0)) / 100)}) will be pending and becomes a strike unless you prove an emergency within the appeal window.
          </p>
          <div>
            <label className="label">Reason</label>
            <select className="input" value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
              {data.cancelReasons.map((r: string) => <option key={r} value={r}>{REASONS[r] || r}</option>)}
            </select>
          </div>
          <textarea className="input" rows={3} placeholder="What happened?" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div>
            <label className="label">Evidence (optional now — you can also add it in your appeal)</label>
            <input type="file" multiple accept="image/*,application/pdf" onChange={async (e) => setEvidence(await Promise.all(Array.from(e.target.files || []).slice(0, 5).map(fileToDataUrl)))} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setCancelOpen(false)}>Keep booking</button>
            <button className="btn-danger" disabled={act.isPending} onClick={() => act.mutate({ path: "cancel", body: { reasonCategory, reason, evidence } })}>
              {act.isPending ? <Spinner /> : "Cancel booking"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
