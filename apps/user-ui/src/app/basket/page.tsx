"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CalendarDays, Clock, Trash2 } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { daysUntil, formatDate, kigaliToday, rwf } from "@/lib/format";
import { useStore } from "@/store";
import useUser from "@/hooks/useUser";
import { useCategories } from "@/hooks/useCategories";
import { Empty, SafetyNotice, Spinner } from "@/components/ui";

export default function BasketPage() {
  const { t } = useI18n();
  const { user } = useUser();
  const { data: cats } = useCategories();
  const basket = useStore((s) => s.basket);
  const remove = useStore((s) => s.removeFromBasket);
  const update = useStore((s) => s.updateItem);
  const [plan, setPlan] = useState<"full" | "deposit">("deposit");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (user?.weddingDistrict && !district) setDistrict(user.weddingDistrict);
    if (user?.phone && !phone) setPhone(user.phone);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/catalog/api/settings/public")).data.settings,
  });
  const bookingFee = settings?.bookingFee ?? 0;
  const depositPercent = settings?.depositPercent ?? 30;
  const balanceDueDays = settings?.balanceDueDays ?? 14;

  if (!mounted) return null;

  const rows = basket.map((item) => {
    const depositAllowed = daysUntil(item.eventDate) > balanceDueDays;
    const effectivePlan = plan === "deposit" && depositAllowed ? "deposit" : "full";
    const now = (effectivePlan === "deposit" ? Math.round((item.price * depositPercent) / 100) : item.price) + bookingFee;
    return { item, depositAllowed, effectivePlan, now };
  });
  const total = basket.reduce((s, i) => s + i.price + bookingFee, 0);
  const dueNow = rows.reduce((s, r) => s + r.now, 0);
  const pastItems = basket.filter((i) => i.eventDate <= kigaliToday());

  const checkout = async () => {
    if (!user) {
      window.location.href = "/login?next=/basket";
      return;
    }
    if (pastItems.length) return toast.error("Some dates are in the past — update them first.");
    if (location.trim().length < 5) return toast.error("Enter the event location");
    if (!district) return toast.error("Choose the event district");
    setSubmitting(true);
    try {
      const { data } = await api.post("/booking/api/checkout", {
        items: basket.map((i) => ({ serviceId: i.serviceId, eventDate: i.eventDate, startTime: i.startTime, selections: i.selections, notes: i.notes })),
        paymentPlan: plan,
        eventLocation: location,
        eventDistrict: district,
        phone: phone || undefined,
      });
      sessionStorage.setItem("huza-last-tx", data.txRef);
      window.location.href = data.paymentLink;
    } catch (e) {
      toast.error(errorMessage(e));
      setSubmitting(false);
    }
  };

  if (basket.length === 0) {
    return (
      <div className="container-x py-12">
        <Empty title={t("basket.empty")} text="Add services with your date and time, then pay for everything at once." action={<Link href="/services" className="btn-primary">{t("hero.cta")}</Link>} />
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-3xl font-semibold">{t("basket.title")}</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {rows.map(({ item, depositAllowed }) => (
            <div key={item.key} className="card flex gap-4 p-4">
              <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">💍</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium uppercase text-brand-700">{cats?.categories.find((c) => c.slug === item.category)?.name || item.category}</p>
                    <Link href={`/services/${item.slug}`} className="font-semibold hover:underline">
                      {item.title}
                    </Link>
                    {item.shopName && <p className="text-xs text-stone-500">{item.shopName}</p>}
                  </div>
                  <button onClick={() => remove(item.key)} className="rounded-full p-2 text-stone-500 hover:bg-stone-100 hover:text-red-600" aria-label="Remove">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <CalendarDays size={14} />
                    <input type="date" min={kigaliToday()} value={item.eventDate} onChange={(e) => update(item.key, { eventDate: e.target.value })} className="rounded border border-stone-300 px-1.5 py-0.5" />
                  </label>
                  <label className="flex items-center gap-1">
                    <Clock size={14} />
                    <input type="time" value={item.startTime} onChange={(e) => update(item.key, { startTime: e.target.value })} className="rounded border border-stone-300 px-1.5 py-0.5" />
                  </label>
                </div>
                {item.selectionLabels.length > 0 && <p className="mt-1 text-xs text-stone-500">{item.selectionLabels.join(" · ")}</p>}
                {!depositAllowed && plan === "deposit" && (
                  <p className="mt-1 text-xs text-amber-700">This event is within {balanceDueDays} days, so it must be paid in full.</p>
                )}
                <p className="mt-2 font-semibold">{rwf(item.price)}</p>
              </div>
            </div>
          ))}
          <p className="text-xs text-stone-500">Dates changed here are re-checked for availability when you continue to payment.</p>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-4 p-5">
            <div>
              <label className="label">{t("field.location")}</label>
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Intare Arena, KG 17 Ave, Rusororo" />
              <p className="mt-1 text-xs text-stone-500">Providers only see the exact location about 2 weeks before the day, once you've paid in full.</p>
            </div>
            <div>
              <label className="label">{t("field.district")}</label>
              <select className="input" value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">Choose…</option>
                {cats?.districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("field.phone")}</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
            </div>

            <div>
              <p className="label">{t("basket.plan")}</p>
              <div className="space-y-2">
                {(["deposit", "full"] as const).map((p) => (
                  <label key={p} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${plan === p ? "border-brand-600 bg-brand-50" : "border-stone-200"}`}>
                    <input type="radio" name="plan" checked={plan === p} onChange={() => setPlan(p)} className="mt-1 accent-brand-700" />
                    <span>
                      <span className="font-semibold">{p === "deposit" ? t("basket.deposit") : t("basket.full")}</span>
                      <span className="block text-xs text-stone-500">
                        {p === "deposit"
                          ? `${depositPercent}% now, the balance is due ${balanceDueDays} days before each event. Unpaid balances cancel the booking under the cancellation policy.`
                          : "Nothing more to pay later."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1 border-t border-stone-100 pt-3 text-sm">
              <div className="flex justify-between">
                <span>Services</span>
                <span>{rwf(basket.reduce((s, i) => s + i.price, 0))}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>
                  {t("basket.bookingFee")} ({basket.length} × {rwf(bookingFee)})
                </span>
                <span>{rwf(bookingFee * basket.length)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t("basket.total")}</span>
                <span>{rwf(total)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-brand-800">
                <span>{t("basket.dueNow")}</span>
                <span>{rwf(dueNow)}</span>
              </div>
              <p className="text-xs text-stone-500">Final prices are confirmed on the next step. Pay by MTN MoMo, Airtel Money or card.</p>
            </div>

            <button onClick={checkout} disabled={submitting} className="btn-primary w-full py-3">
              {submitting ? <Spinner /> : t("action.checkout")}
            </button>
            <p className="text-center text-xs text-stone-500">
              By continuing you agree to the{" "}
              <Link href="/how-it-works#policies" className="underline">
                cancellation & refund policy
              </Link>
              . Your dates are held for 20 minutes while you pay.
            </p>
          </div>
          <SafetyNotice compact />
          {pastItems.length > 0 && <p className="text-sm text-red-600">Update the date for: {pastItems.map((i) => i.title).join(", ")} ({formatDate(pastItems[0].eventDate)} has passed).</p>}
        </aside>
      </div>
    </div>
  );
}
