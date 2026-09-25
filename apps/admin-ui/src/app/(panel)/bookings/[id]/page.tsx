"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate, formatDateTime, rwf } from "@/lib/format";
import { PageLoader } from "@/components/ui";
import { Pill, STATUS_COLORS, Table, Td } from "@/components/Table";

export default function AdminBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({ queryKey: ["admin-booking", id], queryFn: async () => (await api.get(`/admin/api/bookings/${id}`)).data });
  if (isLoading || !data) return <PageLoader />;
  const b = data.booking;
  return (
    <div className="space-y-6">
      <Link href="/bookings" className="text-sm text-stone-500">← Bookings</Link>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold">{b.serviceTitle}</h1><Pill value={b.status} map={STATUS_COLORS} /><Pill value={b.paymentStatus} /></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-1 p-5 text-sm">
          <h2 className="mb-2 font-semibold">Event</h2>
          <p>{formatDate(b.eventDate)} at {b.startTime}</p>
          <p>{b.eventLocation}, {b.eventDistrict}</p>
          {b.selectedOptions.map((o: any) => <p key={o.choiceId} className="text-stone-600">{o.groupName}: {o.label}</p>)}
          {b.notes && <p className="text-stone-600">Notes: {b.notes}</p>}
          <p>Reschedule used: {b.rescheduleUsed ? "yes" : "no"}</p>
          {b.replacementOfId && <p>Replacement of <Link className="text-brand-700" href={`/bookings/${b.replacementOfId}`}>{b.replacementOfId}</Link></p>}
          {b.replacedById && <p>Replaced by <Link className="text-brand-700" href={`/bookings/${b.replacedById}`}>{b.replacedById}</Link></p>}
        </div>
        <div className="card space-y-1 p-5 text-sm">
          <h2 className="mb-2 font-semibold">People</h2>
          <p>Couple: {b.user?.name} · {b.user?.email} · {b.user?.phone || "no phone"}</p>
          <p>Provider: <Link className="text-brand-700" href={`/providers/${data.seller?.id}`}>{data.seller?.name}</Link> · {data.seller?.phone_number}</p>
        </div>
        <div className="card space-y-1 p-5 text-sm">
          <h2 className="mb-2 font-semibold">Money</h2>
          <p>Price {rwf(b.price)} · booking fee {rwf(b.bookingFee)} · plan {b.paymentPlan}</p>
          <p>Paid {rwf(b.amountPaid)} · refunded {rwf(b.refundedAmount)} · processor fee {rwf(b.collectionFee)}</p>
          <p>Provider {rwf(b.providerAmount)} · HUZA {rwf(b.platformAmount)}</p>
          {b.balanceDueDate && <p>Balance due {formatDate(b.balanceDueDate)}</p>}
          {b.releasedAt && <p>Released {formatDateTime(b.releasedAt)}{b.payoutId ? " · paid out" : " · awaiting Thursday"}</p>}
        </div>
      </div>
      {data.cancellations.length > 0 && (
        <div className="card p-5 text-sm">
          <h2 className="font-semibold">Cancellation</h2>
          {data.cancellations.map((c: any) => (
            <div key={c.id} className="mt-2">
              <p>By {c.initiatedBy} · {c.reasonCategory} · {c.daysBeforeEvent} days before · refund {rwf(c.refundAmount)} · provider share {rwf(c.providerShare)}</p>
              {c.reason && <p className="text-stone-600">{c.reason}</p>}
              {c.evidence.map((f: any, i: number) => <a key={i} href={f.url} target="_blank" rel="noreferrer" className="mr-2 text-brand-700 underline">Evidence {i + 1}</a>)}
            </div>
          ))}
        </div>
      )}
      {data.disputes.length > 0 && (
        <div className="card p-5 text-sm">
          <h2 className="font-semibold">Disputes</h2>
          {data.disputes.map((d: any) => (
            <div key={d.id} className="mt-2">
              <p>{d.problemType} · {d.status} · proposed {d.proposedRefundPercent}%{d.resolvedRefundPercent !== null ? ` · resolved ${d.resolvedRefundPercent}%` : ""}</p>
              <p className="text-stone-600">{d.description}</p>
              {d.providerResponse && <p className="text-stone-600">Provider: {d.providerResponse}</p>}
              {d.evidence.map((f: any, i: number) => <a key={i} href={f.url} target="_blank" rel="noreferrer" className="mr-2 text-brand-700 underline">Evidence {i + 1}</a>)}
            </div>
          ))}
        </div>
      )}
      <h2 className="text-lg font-semibold">Payments</h2>
      <Table head={["Reference", "Purpose", "Amount", "Fee", "Refunded", "Status", "Date"]}>
        {data.payments.map((p: any) => <tr key={p.id}><Td>{p.txRef}</Td><Td>{p.purpose}</Td><Td>{rwf(p.amount)}</Td><Td>{rwf(p.fee)}</Td><Td>{rwf(p.refunded)}</Td><Td><Pill value={p.status} map={STATUS_COLORS} /></Td><Td>{formatDateTime(p.createdAt)}</Td></tr>)}
      </Table>
      <h2 className="text-lg font-semibold">Ledger</h2>
      <Table head={["Date", "Type", "Description", "Amount"]}>
        {data.ledger.map((l: any) => <tr key={l.id}><Td>{formatDateTime(l.createdAt)}</Td><Td>{l.type}</Td><Td>{l.description}</Td><Td className={l.amount < 0 ? "text-red-600" : ""}>{rwf(l.amount)}</Td></tr>)}
      </Table>
      {data.messages.length > 0 && (
        <div className="card p-5 text-sm">
          <h2 className="font-semibold">Wedding-day chat</h2>
          {data.messages.map((m: any) => <p key={m.id} className="mt-1"><span className="font-medium">{m.senderType}:</span> {m.text} <span className="text-xs text-stone-400">{formatDateTime(m.createdAt)}</span></p>)}
        </div>
      )}
    </div>
  );
}
