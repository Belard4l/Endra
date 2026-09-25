"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, MapPin, Phone, Send } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { STATUS_LABELS, fileToDataUrl, formatDate, formatDateTime, kigaliToday, rwf } from "@/lib/format";
import RequireUser from "@/components/RequireUser";
import OptionPicker from "@/components/OptionPicker";
import { Empty, Modal, PageLoader, SafetyNotice, Spinner, StarInput, Stars, StatusBadge } from "@/components/ui";

const Row = ({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) => (
  <div className={`flex justify-between gap-4 py-1 text-sm ${bold ? "font-semibold" : ""}`}>
    <span className="text-stone-600">{label}</span>
    <span>{value}</span>
  </div>
);

const Chat = ({ bookingId }: { bookingId: string }) => {
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["messages", bookingId],
    queryFn: async () => (await api.get(`/booking/api/bookings/${bookingId}/messages`)).data as { messages: any[]; open: boolean },
    refetchInterval: 8000,
  });
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [data?.messages.length]);
  const send = useMutation({
    mutationFn: async () => api.post(`/booking/api/bookings/${bookingId}/messages`, { text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", bookingId] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="card p-5">
      <h3 className="font-semibold">Wedding-day chat</h3>
      <p className="muted">Open today only, to coordinate with your provider.</p>
      <div className="mt-3 h-64 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-3">
        {(data?.messages || []).map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.senderType === "user" ? "ml-auto bg-brand-700 text-white" : "bg-white"}`}>
            {m.text}
            <div className={`mt-0.5 text-[10px] ${m.senderType === "user" ? "text-brand-100" : "text-stone-400"}`}>{formatDateTime(m.createdAt)}</div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
      >
        <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
        <button className="btn-primary" disabled={send.isPending}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | "cancel" | "reschedule" | "dispute" | "replace">(null);
  const [reason, setReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [problem, setProblem] = useState("late_arrival");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [replacement, setReplacement] = useState<any>(null);
  const [replSelections, setReplSelections] = useState<Record<string, string[]>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => (await api.get(`/booking/api/bookings/${id}`)).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["booking", id] });
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
  };
  const action = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: any }) => (await api.post(`/booking/api/bookings/${id}/${path}`, body || {})).data,
    onSuccess: (res, vars) => {
      if (res?.paymentLink) {
        sessionStorage.setItem("huza-last-tx", res.txRef);
        window.location.href = res.paymentLink;
        return;
      }
      const msgs: Record<string, string> = {
        cancel: "Booking cancelled",
        reschedule: "Booking rescheduled",
        "choose-refund": "Refund requested",
        "choose-replacement": "Replacement booked",
        "confirm-delivery": "Thanks! The provider will be paid on Thursday.",
        dispute: "Problem reported. HUZA will review it.",
        review: "Thanks for your review!",
      };
      toast.success(msgs[vars.path] || "Done");
      setModal(null);
      if (vars.path === "choose-replacement" && res?.booking?.id) window.location.href = `/bookings/${res.booking.id}`;
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (!data) return <div className="container-x py-12"><Empty title="Booking not found" /></div>;
  const b = data.booking;
  const quote = data.cancellationQuote;
  const presets = data.disputePresets as Record<string, { label: string; refundPercent: number }>;

  return (
    <div className="container-x py-8">
      <Link href="/bookings" className="text-sm text-stone-500">
        ← My bookings
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{b.serviceTitle}</h1>
        <StatusBadge status={b.status} map={STATUS_LABELS} />
      </div>
      <p className="text-stone-500">
        {data.shop?.name} ·{" "}
        {data.serviceSlug && (
          <Link className="underline" href={`/services/${data.serviceSlug}`}>
            View listing
          </Link>
        )}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Provider cancelled → alternatives */}
          {b.status === "cancelled_by_provider" && b.resolution === "awaiting_choice" && (
            <div className="card border-red-200 p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-red-700">
                <AlertTriangle size={20} /> Your provider cancelled — your money is safe
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Pick one of these available alternatives (same category, free on {formatDate(b.eventDate)}, similar price) or take a full refund
                of {rwf(b.amountPaid - b.refundedAmount)}. Decide before {formatDate(b.resolutionDeadline)} — otherwise we refund you automatically.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.alternatives.length === 0 && <p className="text-sm text-stone-500">No available alternatives right now.</p>}
                {data.alternatives.map((a: any) => (
                  <div key={a.id} className="rounded-xl border border-stone-200 p-3">
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-xs text-stone-500">{a.shop?.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">{rwf(a.basePrice)}</span>
                      <Stars value={a.ratings} count={a.reviewCount} />
                    </div>
                    <p className={`text-xs ${a.priceDifference > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {a.priceDifference === 0 ? "Same price" : a.priceDifference > 0 ? `${rwf(a.priceDifference)} more — you'd pay the difference` : `${rwf(-a.priceDifference)} less — we refund the difference`}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Link href={`/services/${a.slug}`} target="_blank" className="btn-ghost px-2 py-1 text-xs">
                        Details
                      </Link>
                      <button
                        className="btn-primary px-3 py-1 text-xs"
                        onClick={() => {
                          setReplacement(a);
                          const init: Record<string, string[]> = {};
                          a.optionGroups.forEach((g: any) => g.required && g.type === "single" && (init[g.id] = [g.choices[0]?.id]));
                          setReplSelections(init);
                          setModal("replace");
                        }}
                      >
                        Choose this
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-outline mt-4" disabled={action.isPending} onClick={() => action.mutate({ path: "choose-refund" })}>
                I'd rather get a full refund
              </button>
            </div>
          )}

          {/* Delivered → confirm or dispute */}
          {b.status === "completed" && (
            <div className="card border-sky-200 p-5">
              <h2 className="text-lg font-semibold">Was everything delivered as agreed?</h2>
              <p className="mt-1 text-sm text-stone-600">
                If you don't report a problem by {formatDateTime(b.releaseAt)}, the provider is paid automatically.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary" disabled={action.isPending} onClick={() => action.mutate({ path: "confirm-delivery" })}>
                  <CheckCircle2 size={16} /> Yes, confirm delivery
                </button>
                <button className="btn-outline" onClick={() => setModal("dispute")}>
                  Report a problem
                </button>
              </div>
            </div>
          )}
          {b.status === "confirmed" && kigaliToday() > b.eventDate && (
            <div className="card p-5">
              <p className="text-sm">Didn't the provider show up, or was something wrong?</p>
              <button className="btn-outline mt-3" onClick={() => setModal("dispute")}>
                Report a problem
              </button>
            </div>
          )}

          {data.dispute && (
            <div className="card p-5">
              <h2 className="font-semibold">Reported problem</h2>
              <p className="mt-1 text-sm">
                {presets[data.dispute.problemType]?.label} — <span className="font-medium">{data.dispute.status}</span>
              </p>
              <p className="mt-1 text-sm text-stone-600">{data.dispute.description}</p>
              {data.dispute.status !== "open" && (
                <p className="mt-2 text-sm">
                  Outcome: {data.dispute.resolvedRefundPercent}% refund{data.dispute.adminNote ? ` — ${data.dispute.adminNote}` : ""}
                </p>
              )}
            </div>
          )}

          {/* Review */}
          {b.status === "released" && b.completedAt && !data.review && (
            <div className="card p-5">
              <h2 className="text-lg font-semibold">Leave a review</h2>
              <p className="muted">Your review helps other couples and rewards great providers.</p>
              <div className="mt-3">
                <StarInput value={rating} onChange={setRating} />
              </div>
              <textarea className="input mt-3" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the service?" />
              <button className="btn-primary mt-3" disabled={action.isPending} onClick={() => action.mutate({ path: "review", body: { rating, comment } })}>
                Submit review
              </button>
            </div>
          )}
          {data.review && (
            <div className="card p-5">
              <h2 className="font-semibold">Your review</h2>
              <Stars value={data.review.rating} />
              {data.review.comment && <p className="mt-1 text-sm">{data.review.comment}</p>}
            </div>
          )}

          {data.chatOpen && <Chat bookingId={b.id} />}

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Event</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <span className="flex items-center gap-2">
                <CalendarDays size={16} /> {formatDate(b.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
              <span className="flex items-center gap-2">
                <Clock size={16} /> {b.startTime}
                {b.endTime ? ` – ${b.endTime}` : ""}
              </span>
              <span className="flex items-center gap-2 sm:col-span-2">
                <MapPin size={16} /> {b.eventLocation}, {b.eventDistrict}
              </span>
            </div>
            {b.selectedOptions.length > 0 && (
              <ul className="mt-3 list-inside list-disc text-sm text-stone-600">
                {b.selectedOptions.map((o: any) => (
                  <li key={o.choiceId}>
                    {o.groupName}: {o.label}
                  </li>
                ))}
              </ul>
            )}
            {b.notes && <p className="mt-3 text-sm text-stone-600">Notes: {b.notes}</p>}
            {data.providerContact && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <Phone size={16} /> Today's contact: {data.providerContact.name} — {data.providerContact.phone}
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-2 font-semibold">Payment</h2>
            <Row label="Service price" value={rwf(b.price)} />
            <Row label="Booking fee" value={rwf(b.bookingFee)} />
            <Row label="Paid" value={rwf(b.amountPaid)} />
            {b.refundedAmount > 0 && <Row label="Refunded" value={rwf(b.refundedAmount)} />}
            {b.status === "confirmed" && <Row label="Remaining" value={rwf(data.remaining)} bold />}
            {b.balanceDueDate && data.remaining > 0 && b.status === "confirmed" && <p className="mt-1 text-xs text-amber-700">Due by {formatDate(b.balanceDueDate)}</p>}
            {b.status === "confirmed" && data.remaining > 0 && (
              <button className="btn-primary mt-3 w-full" disabled={action.isPending} onClick={() => action.mutate({ path: "pay-balance" })}>
                Pay {rwf(data.remaining)} now
              </button>
            )}
          </div>

          {b.status === "confirmed" && kigaliToday() < b.eventDate && (
            <div className="card space-y-2 p-5">
              <h2 className="font-semibold">Need to change something?</h2>
              <button className="btn-outline w-full" disabled={b.rescheduleUsed} onClick={() => setModal("reschedule")}>
                {b.rescheduleUsed ? "Free reschedule already used" : "Reschedule (one free change)"}
              </button>
              <button className="btn-ghost w-full text-red-600" onClick={() => setModal("cancel")}>
                Cancel booking
              </button>
            </div>
          )}
          <SafetyNotice compact />
        </aside>
      </div>

      {/* Cancel */}
      <Modal open={modal === "cancel"} onClose={() => setModal(null)} title="Cancel this booking?">
        {quote && (
          <div className="space-y-3 text-sm">
            <p>
              Your event is <strong>{quote.daysBeforeEvent} days</strong> away ({quote.tierLabel.toLowerCase()}), so you get a{" "}
              <strong>{quote.refundPercent}% refund</strong> of the {rwf(quote.servicePaid)} you paid for the service:{" "}
              <strong>{rwf(quote.refund)}</strong>. The booking fee ({rwf(quote.bookingFeeKept)}) isn't refundable.
            </p>
            {!b.rescheduleUsed && <p className="rounded-lg bg-sky-50 p-3 text-sky-900">Tip: you can move the date for free once instead of cancelling.</p>}
            <SafetyNotice compact />
            <textarea className="input" rows={2} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setModal(null)}>
                Keep booking
              </button>
              <button className="btn-danger" disabled={action.isPending} onClick={() => action.mutate({ path: "cancel", body: { reason } })}>
                {action.isPending ? <Spinner /> : "Cancel booking"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reschedule */}
      <Modal open={modal === "reschedule"} onClose={() => setModal(null)} title="Reschedule (one free change)">
        <div className="space-y-3">
          <div>
            <label className="label">New date</label>
            <input type="date" min={kigaliToday()} className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Start time</label>
            <input type="time" className="input" value={newTime || b.startTime} onChange={(e) => setNewTime(e.target.value)} />
          </div>
          <p className="text-xs text-stone-500">The provider must be free on the new date. If they aren't, you can pick another date, another provider, or cancel under the policy.</p>
          <button className="btn-primary w-full" disabled={!newDate || action.isPending} onClick={() => action.mutate({ path: "reschedule", body: { eventDate: newDate, startTime: newTime || b.startTime } })}>
            Confirm new date
          </button>
        </div>
      </Modal>

      {/* Dispute */}
      <Modal open={modal === "dispute"} onClose={() => setModal(null)} title="Report a problem">
        <div className="space-y-3">
          <div>
            <label className="label">What went wrong?</label>
            <select className="input" value={problem} onChange={(e) => setProblem(e.target.value)}>
              {Object.entries(presets || {}).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                  {v.refundPercent ? ` — usually ${v.refundPercent}% refund` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Describe what happened</label>
            <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Evidence (photos, up to 5)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={async (e) => {
                const list = Array.from(e.target.files || []).slice(0, 5);
                setFiles(await Promise.all(list.map(fileToDataUrl)));
              }}
            />
          </div>
          <p className="text-xs text-stone-500">Payment to the provider is paused while HUZA reviews. An admin confirms the final refund.</p>
          <button className="btn-primary w-full" disabled={action.isPending} onClick={() => action.mutate({ path: "dispute", body: { problemType: problem, description, evidence: files } })}>
            Submit report
          </button>
        </div>
      </Modal>

      {/* Replacement */}
      <Modal open={modal === "replace"} onClose={() => setModal(null)} title={`Book ${replacement?.title || ""}`}>
        {replacement && (
          <div className="space-y-4">
            {replacement.optionGroups.length > 0 && <OptionPicker groups={replacement.optionGroups} value={replSelections} onChange={setReplSelections} />}
            <div>
              <label className="label">Start time</label>
              <input type="time" className="input" value={newTime || b.startTime} onChange={(e) => setNewTime(e.target.value)} />
            </div>
            <p className="text-sm text-stone-600">Your existing payment moves to this booking. If it costs less, we refund the difference; if it costs more, you'll pay the rest as a balance.</p>
            <button
              className="btn-primary w-full"
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  path: "choose-replacement",
                  body: {
                    serviceId: replacement.id,
                    startTime: newTime || b.startTime,
                    selections: Object.entries(replSelections).map(([groupId, choiceIds]) => ({ groupId, choiceIds })),
                  },
                })
              }
            >
              Confirm replacement
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function BookingDetailPage() {
  return (
    <RequireUser>
      <BookingDetail />
    </RequireUser>
  );
}
