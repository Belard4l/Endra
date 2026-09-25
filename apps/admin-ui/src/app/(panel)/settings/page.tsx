"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { fileToDataUrl } from "@/lib/format";
import { PageLoader } from "@/components/ui";

const FIELDS: { key: string; label: string; help: string }[] = [
  { key: "commissionPercent", label: "HUZA commission (%)", help: "Taken from each booking after the processing fee (default 15)." },
  { key: "bookingFee", label: "Booking fee per booking (RWF)", help: "Paid by the couple; covers payout transfer fees." },
  { key: "depositPercent", label: "Deposit (%)", help: "Share of the service price paid at booking on the deposit plan." },
  { key: "balanceDueDays", label: "Balance due (days before event)", help: "Unpaid balances after this cancel the booking under the couple policy." },
  { key: "disputeWindowHours", label: "Dispute window (hours)", help: "Time after delivery for couples to report a problem before release." },
  { key: "appealWindowDays", label: "Fine appeal window (days)", help: "Time providers have to appeal a cancellation fine." },
  { key: "locationRevealDays", label: "Location reveal (days before event)", help: "When fully paid bookings show the venue to providers." },
];

export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-settings"], queryFn: async () => (await api.get("/admin/api/settings")).data.settings });
  const [f, setF] = useState<any>({});
  const [hero, setHero] = useState("");
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = useMutation({
    mutationFn: async () => api.put("/admin/api/settings", { ...Object.fromEntries(FIELDS.map((x) => [x.key, f[x.key]])), heroTitle: f.heroTitle, heroSubtitle: f.heroSubtitle, heroImage: hero || undefined }),
    onSuccess: () => { toast.success("Settings saved"); setHero(""); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading) return <PageLoader />;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="card grid gap-5 p-6 sm:grid-cols-2">
        {FIELDS.map((x) => (
          <div key={x.key}>
            <label className="label">{x.label}</label>
            <input type="number" className="input" value={f[x.key] ?? ""} onChange={(e) => setF({ ...f, [x.key]: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-stone-500">{x.help}</p>
          </div>
        ))}
      </div>
      <div className="card space-y-4 p-6">
        <h2 className="font-semibold">Homepage</h2>
        <input className="input" placeholder="Hero title (leave empty for default)" value={f.heroTitle || ""} onChange={(e) => setF({ ...f, heroTitle: e.target.value })} />
        <textarea className="input" rows={2} placeholder="Hero subtitle" value={f.heroSubtitle || ""} onChange={(e) => setF({ ...f, heroSubtitle: e.target.value })} />
        <div className="flex items-center gap-4">
          {(hero || f.heroImage?.url) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero || f.heroImage.url} alt="" className="h-20 w-36 rounded-lg object-cover" />
          )}
          <label className="btn-outline cursor-pointer">Change hero image<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setHero(await fileToDataUrl(file)); }} /></label>
        </div>
      </div>
      <p className="text-sm text-stone-500">Cancellation tiers, fine percentages and strike thresholds are set in code (packages/utils/config.ts) so they always match the published terms.</p>
      <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Save settings</button>
    </div>
  );
}
