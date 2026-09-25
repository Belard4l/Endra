"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate, rwf } from "@/lib/format";
import { PageLoader, Pagination } from "@/components/ui";
import { Pill, STATUS_COLORS, Table, Td, downloadCsv } from "@/components/Table";

const STATUSES = ["confirmed", "completed", "disputed", "released", "cancelled_by_couple", "cancelled_by_provider", "replaced"];

export default function AdminBookings() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["admin-bookings", q, status, page], queryFn: async () => (await api.get(`/admin/api/bookings?q=${encodeURIComponent(q)}&status=${status}&page=${page}`)).data });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <button className="btn-outline" onClick={() => downloadCsv("/admin/api/bookings/export", "huza-bookings.csv", api)}>Export CSV</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input w-64" placeholder="Search service or district" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      {isLoading ? <PageLoader /> : (
        <>
          <Table head={["Event", "Service", "Couple", "Price", "Paid", "Status", "Payment"]}>
            {data.bookings.map((b: any) => (
              <tr key={b.id} className="hover:bg-stone-50">
                <Td><Link href={`/bookings/${b.id}`} className="font-medium text-brand-700">{formatDate(b.eventDate)}</Link><span className="block text-xs text-stone-500">{b.eventDistrict}</span></Td>
                <Td>{b.serviceTitle}<span className="block text-xs text-stone-500">{b.category}</span></Td>
                <Td>{b.user?.name}<span className="block text-xs text-stone-500">{b.user?.email}</span></Td>
                <Td>{rwf(b.price)}</Td>
                <Td>{rwf(b.amountPaid)}{b.refundedAmount > 0 && <span className="block text-xs text-red-600">−{rwf(b.refundedAmount)}</span>}</Td>
                <Td><Pill value={b.status} map={STATUS_COLORS} /></Td>
                <Td><Pill value={b.paymentStatus} /></Td>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
