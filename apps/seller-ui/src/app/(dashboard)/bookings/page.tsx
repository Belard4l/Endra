"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import api from "@/lib/api";
import { PROVIDER_STATUS_LABELS, formatDate, rwf } from "@/lib/format";
import { Empty, PageLoader, StatusBadge } from "@/components/ui";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "awaiting", label: "Delivered / in review" },
  { key: "past", label: "Past & cancelled" },
];

export default function SellerBookings() {
  const [tab, setTab] = useState("upcoming");
  const { data, isLoading } = useQuery({ queryKey: ["seller-bookings", tab], queryFn: async () => (await api.get(`/booking/api/seller/bookings?filter=${tab}`)).data.bookings as any[] });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <div className="flex gap-2 border-b border-stone-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-brand-700 text-brand-700" : "border-transparent text-stone-500"}`}>{t.label}</button>
        ))}
      </div>
      {isLoading ? <PageLoader /> : !data?.length ? <Empty title="No bookings here" /> : (
        <div className="space-y-3">
          {data.map((b) => (
            <Link key={b.id} href={`/bookings/${b.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:shadow">
              <div>
                <p className="font-semibold">{b.serviceTitle}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-stone-600">
                  <span className="flex items-center gap-1"><CalendarDays size={14} /> {formatDate(b.eventDate)}</span>
                  <span className="flex items-center gap-1"><Clock size={14} /> {b.startTime}</span>
                  <span className="flex items-center gap-1"><MapPin size={14} /> {b.eventDistrict}</span>
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={b.status} map={PROVIDER_STATUS_LABELS} />
                <p className="mt-1 text-sm">{rwf(b.price)} · {b.paymentStatus === "paid" ? "fully paid" : b.paymentStatus === "deposit_paid" ? "deposit paid" : b.paymentStatus.replace("_", " ")}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
