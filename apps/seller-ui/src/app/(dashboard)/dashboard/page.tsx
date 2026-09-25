"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarCheck, Gavel, MessageCircleQuestion, TrendingUp, Wallet } from "lucide-react";
import api from "@/lib/api";
import { PROVIDER_STATUS_LABELS, formatDate, rwf } from "@/lib/format";
import { PageLoader, StatusBadge } from "@/components/ui";

const Stat = ({ icon: Icon, label, value, hint, href }: { icon: any; label: string; value: React.ReactNode; hint?: string; href?: string }) => {
  const body = (
    <div className="card h-full p-5">
      <div className="flex items-center gap-2 text-sm text-stone-500"><Icon size={16} /> {label}</div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
};

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["seller-dashboard"], queryFn: async () => (await api.get("/booking/api/seller/dashboard")).data });
  if (isLoading || !data) return <PageLoader />;
  const s = data.stats;
  const max = Math.max(1, ...data.monthlyEarnings.map((m: any) => m.amount));
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CalendarCheck} label="Upcoming bookings" value={s.upcomingBookings} href="/bookings" />
        <Stat icon={Wallet} label="Next Thursday payout" value={rwf(s.nextPayout)} hint={s.outstandingFines ? `Fines to deduct: ${rwf(s.outstandingFines)}` : "Released earnings not yet paid"} href="/payouts" />
        <Stat icon={TrendingUp} label="Weddings delivered" value={s.completedWeddings} hint={`Visibility score ${Math.round(s.visibilityScore)}`} />
        <Stat icon={MessageCircleQuestion} label="Unanswered questions" value={s.unansweredQuestions} hint="Quick answers win bookings" href="/questions" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={AlertCircle} label="Awaiting release" value={s.awaitingRelease} hint="Delivered, in the couple's review window" />
        <Stat icon={Wallet} label="Paid out so far" value={rwf(s.paidOut)} />
        <Stat icon={Gavel} label="Active strikes" value={s.activeStrikes} hint={s.pendingFines ? `${s.pendingFines} fine(s) pending or appealed` : "Strikes last 12 months"} href="/penalties" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Earnings released (last 6 months)</h2>
          {data.monthlyEarnings.length === 0 ? (
            <p className="muted mt-4">No earnings yet — your first delivered wedding will show here.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {data.monthlyEarnings.map((m: any) => (
                <div key={m.month} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-stone-500">{m.month}</span>
                  <div className="h-3 flex-1 rounded-full bg-stone-100">
                    <div className="h-3 rounded-full bg-brand-600" style={{ width: `${(m.amount / max) * 100}%` }} />
                  </div>
                  <span className="w-28 text-right font-medium">{rwf(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent bookings</h2>
            <Link href="/bookings" className="text-sm text-brand-700">All bookings</Link>
          </div>
          <div className="mt-3 divide-y divide-stone-100">
            {data.recent.length === 0 && <p className="muted py-3">No bookings yet.</p>}
            {data.recent.map((b: any) => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between gap-2 py-3 text-sm hover:bg-stone-50">
                <span>
                  <span className="font-medium">{b.serviceTitle}</span>
                  <span className="block text-xs text-stone-500">{formatDate(b.eventDate)} · {b.eventDistrict}</span>
                </span>
                <StatusBadge status={b.status} map={PROVIDER_STATUS_LABELS} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5 text-sm text-stone-700">
        <h2 className="font-semibold">How visibility works</h2>
        <p className="mt-1">Every wedding you deliver, every good review and recent activity move you up in search and recommendations. New providers get a temporary boost for their first 30 days or 3 bookings. Cancellations and strikes move you down.</p>
      </div>
    </div>
  );
}
