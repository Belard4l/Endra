"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate, rwf } from "@/lib/format";
import { PageLoader } from "@/components/ui";
import { Pill, STATUS_COLORS } from "@/components/Table";

const Card = ({ label, value, href, alert }: { label: string; value: React.ReactNode; href?: string; alert?: boolean }) => {
  const body = (
    <div className={`card h-full p-5 ${alert ? "border-brand-300 bg-brand-50" : ""}`}>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
};

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: async () => (await api.get("/admin/api/dashboard")).data });
  if (isLoading || !data) return <PageLoader />;
  const s = data.stats;
  const max = Math.max(1, ...data.monthly.map((m: any) => m.volume));
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Pending verifications" value={s.pendingVerification} href="/providers?verification=pending" alert={s.pendingVerification > 0} />
        <Card label="Open disputes" value={s.openDisputes} href="/disputes" alert={s.openDisputes > 0} />
        <Card label="Fine appeals" value={s.appeals} href="/penalties" alert={s.appeals > 0} />
        <Card label="Failed payouts" value={s.failedPayouts} href="/payouts?status=failed" alert={s.failedPayouts > 0} />
      </div>
      {s.banRecommended > 0 && (
        <Link href="/providers?banRecommended=true" className="block rounded-xl bg-red-600 p-4 text-white">{s.banRecommended} provider(s) reached 4+ strikes — review for a permanent ban →</Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Couples" value={s.users} href="/users" />
        <Card label="Providers" value={s.providers} href="/providers" />
        <Card label="Active bookings" value={s.activeBookings} href="/bookings" />
        <Card label="Payments received" value={rwf(s.paymentsReceived)} />
        <Card label="Commission earned" value={rwf(s.commission)} />
        <Card label="Booking fees" value={rwf(s.bookingFees)} />
        <Card label="Processor fees paid" value={rwf(s.collectionFees)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Released volume by month</h2>
          <div className="mt-4 space-y-2">
            {data.monthly.length === 0 && <p className="muted">No released bookings yet.</p>}
            {data.monthly.map((m: any) => (
              <div key={m.month} className="flex items-center gap-3 text-sm">
                <span className="w-16 text-stone-500">{m.month}</span>
                <div className="h-3 flex-1 rounded-full bg-stone-100"><div className="h-3 rounded-full bg-brand-600" style={{ width: `${(m.volume / max) * 100}%` }} /></div>
                <span className="w-44 text-right">{rwf(m.volume)} <span className="text-stone-400">({rwf(m.commission)})</span></span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Bookings by category</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {data.byCategory.map((c: any) => <li key={c.category} className="flex justify-between"><span>{c.category}</span><span className="font-medium">{c.count}</span></li>)}
          </ul>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-semibold">Latest bookings</h2>
        <div className="mt-3 divide-y divide-stone-100 text-sm">
          {data.recent.map((b: any) => (
            <Link key={b.id} href={`/bookings/${b.id}`} className="flex justify-between py-2 hover:bg-stone-50">
              <span>{b.serviceTitle} · {formatDate(b.eventDate)} · {b.eventDistrict}</span>
              <Pill value={b.status} map={STATUS_COLORS} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
