"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { kigaliToday } from "@/lib/format";
import { PageLoader } from "@/components/ui";

const pad = (n: number) => String(n).padStart(2, "0");

export default function Availability() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["availability"], queryFn: async () => (await api.get("/catalog/api/seller/availability")).data });
  const [capacity, setCapacity] = useState(1);
  const [blocked, setBlocked] = useState<string[]>([]);
  const today = kigaliToday();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  useEffect(() => {
    if (data) {
      setCapacity(data.capacityPerDay);
      setBlocked(data.blockedDates);
    }
  }, [data]);

  const bookedCount = useMemo(() => {
    const m: Record<string, number> = {};
    (data?.bookings || []).forEach((b: any) => (m[b.eventDate] = (m[b.eventDate] || 0) + 1));
    return m;
  }, [data]);

  const save = useMutation({
    mutationFn: async () => api.put("/catalog/api/seller/availability", { capacityPerDay: capacity, blockedDates: blocked }),
    onSuccess: () => { toast.success("Availability saved"); qc.invalidateQueries({ queryKey: ["availability"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`)];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Availability</h1>
      <div className="card flex flex-wrap items-end gap-4 p-5">
        <div>
          <label className="label">Events you can take per day</label>
          <input type="number" min={1} max={20} className="input w-32" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        </div>
        <p className="muted max-w-md">Couples can't book you on a day once this many bookings are confirmed, or on dates you block below.</p>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <button className="btn-ghost" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))}><ChevronLeft /></button>
          <p className="font-semibold">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
          <button className="btn-ghost" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))}><ChevronRight /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-500">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const past = d < today;
            const isBlocked = blocked.includes(d);
            const booked = bookedCount[d] || 0;
            const full = booked >= capacity;
            return (
              <button
                key={d}
                disabled={past || booked > 0}
                onClick={() => setBlocked(isBlocked ? blocked.filter((x) => x !== d) : [...blocked, d])}
                className={`flex h-16 flex-col items-center justify-center rounded-lg border text-sm ${
                  past ? "border-transparent text-stone-300" : isBlocked ? "border-red-300 bg-red-50 text-red-700" : full ? "border-brand-300 bg-brand-100 text-brand-800" : booked ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-stone-200 hover:bg-stone-50"
                }`}
                title={booked ? `${booked} booking(s)` : isBlocked ? "Blocked — click to unblock" : "Click to block"}
              >
                {Number(d.slice(8))}
                <span className="text-[10px]">{isBlocked ? "blocked" : booked ? `${booked} booked` : ""}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-stone-600">
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-100" /> Has bookings</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-brand-100" /> Fully booked</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-red-100" /> Blocked by you</span>
        </div>
        <p className="mt-3 text-xs text-stone-500">Days with bookings can't be blocked. If you truly can't attend a booking, cancel it from the booking page (a fine applies unless it's an emergency you can prove).</p>
      </div>
      <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Save availability</button>
    </div>
  );
}
