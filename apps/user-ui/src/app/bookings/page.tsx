"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import api from "@/lib/api";
import { STATUS_LABELS, formatDate, kigaliToday, rwf } from "@/lib/format";
import RequireUser from "@/components/RequireUser";
import { Empty, PageLoader, StatusBadge } from "@/components/ui";

function Bookings() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => (await api.get("/booking/api/my-bookings")).data as { bookings: any[]; stats: { upcoming: number; total: number; balanceDue: number } },
  });
  if (isLoading) return <PageLoader />;
  const today = kigaliToday();
  const upcoming = (data?.bookings || []).filter((b) => b.eventDate >= today && !["released", "cancelled_by_couple", "replaced"].includes(b.status));
  const past = (data?.bookings || []).filter((b) => !upcoming.includes(b));

  const Row = ({ b }: { b: any }) => {
    const remaining = Math.max(0, b.price + b.bookingFee - (b.amountPaid - b.refundedAmount));
    return (
      <Link href={`/bookings/${b.id}`} className="card flex gap-4 p-4 transition hover:shadow">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100">
          {b.serviceImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.serviceImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl">💍</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{b.serviceTitle}</p>
            <StatusBadge status={b.status} map={STATUS_LABELS} />
          </div>
          <p className="text-sm text-stone-500">{b.shop?.name}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-stone-600">
            <span className="flex items-center gap-1">
              <CalendarDays size={14} /> {formatDate(b.eventDate)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} /> {b.startTime}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {b.eventDistrict}
            </span>
          </div>
          {b.status === "confirmed" && remaining > 0 && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Balance {rwf(remaining)} due {b.balanceDueDate ? `by ${formatDate(b.balanceDueDate)}` : ""}
            </p>
          )}
          {b.status === "cancelled_by_provider" && b.resolution === "awaiting_choice" && (
            <p className="mt-1 text-sm font-medium text-red-700">Action needed: choose a replacement or a refund</p>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-semibold">My bookings</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="muted">Upcoming</p>
          <p className="text-2xl font-bold">{data?.stats.upcoming ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="muted">All bookings</p>
          <p className="text-2xl font-bold">{data?.stats.total ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="muted">Balance still to pay</p>
          <p className="text-2xl font-bold">{rwf(data?.stats.balanceDue ?? 0)}</p>
        </div>
      </div>

      <h2 className="mb-3 mt-10 text-xl font-semibold">Upcoming</h2>
      {upcoming.length === 0 ? (
        <Empty title="No upcoming bookings" action={<Link href="/services" className="btn-primary">Find services</Link>} />
      ) : (
        <div className="space-y-3">{upcoming.map((b) => <Row key={b.id} b={b} />)}</div>
      )}
      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-xl font-semibold">Past & cancelled</h2>
          <div className="space-y-3">{past.map((b) => <Row key={b.id} b={b} />)}</div>
        </>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <RequireUser>
      <Bookings />
    </RequireUser>
  );
}
