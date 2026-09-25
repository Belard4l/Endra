"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, HandCoins, PartyPopper, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import useUser from "@/hooks/useUser";
import { ServiceGrid } from "@/components/ServiceCard";
import { SafetyNotice, Skeleton, Stars } from "@/components/ui";
import { kigaliToday } from "@/lib/format";
import type { ServiceCardData } from "@/lib/types";

const SectionTitle = ({ title, href, cta }: { title: string; href?: string; cta?: string }) => (
  <div className="mb-5 flex items-end justify-between">
    <h2 className="text-2xl font-semibold">{title}</h2>
    {href && (
      <Link href={href} className="text-sm font-semibold text-brand-700 hover:underline">
        {cta}
      </Link>
    )}
  </div>
);

const GridSkeleton = () => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-72" />
    ))}
  </div>
);

export default function HomePage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { user } = useUser();
  const { data: cats } = useCategories();
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState({ date: "", district: "", budget: "" });
  const [submittedPlan, setSubmittedPlan] = useState<typeof plan | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/catalog/api/settings/public")).data.settings,
  });

  const effectivePlan = submittedPlan || {
    date: user?.weddingDate || "",
    district: user?.weddingDistrict || "",
    budget: user?.budget ? String(user.budget) : "",
  };

  const { data: recs, isLoading: recsLoading } = useQuery({
    queryKey: ["recommendations", user?.id, effectivePlan],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectivePlan.date) params.set("date", effectivePlan.date);
      if (effectivePlan.district) params.set("district", effectivePlan.district);
      if (effectivePlan.budget) params.set("budget", effectivePlan.budget);
      return (await api.get(`/catalog/api/recommendations?${params}`)).data as { recommendations: ServiceCardData[]; missingCategories: string[] };
    },
  });

  const { data: latest, isLoading: latestLoading } = useQuery({
    queryKey: ["latest-services"],
    queryFn: async () => (await api.get("/catalog/api/services?sort=newest&limit=8")).data.services as ServiceCardData[],
  });

  const { data: providers } = useQuery({
    queryKey: ["top-providers"],
    queryFn: async () => (await api.get("/catalog/api/providers?limit=6")).data.providers as any[],
  });

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/services?q=${encodeURIComponent(q)}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        {settings?.heroImage?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.heroImage.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        )}
        <div className="container-x relative py-20 sm:py-28">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">{settings?.heroTitle || t("hero.title")}</h1>
          <p className="mt-4 max-w-xl text-lg text-brand-100">{settings?.heroSubtitle || t("hero.subtitle")}</p>
          <form onSubmit={search} className="mt-8 flex max-w-xl gap-2 rounded-xl bg-white p-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} className="flex-1 px-3 text-ink outline-none" />
            <button className="btn-primary">
              <Search size={18} /> {t("search.button")}
            </button>
          </form>
        </div>
      </section>

      <div className="container-x space-y-16 py-12">
        {/* Categories */}
        <section>
          <SectionTitle title={t("home.categories")} href="/services" cta={t("action.viewAll")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {(cats?.categories || []).map((c) => (
              <Link key={c.slug} href={`/services?category=${c.slug}`} className="card flex flex-col items-center gap-2 p-4 text-center transition hover:border-brand-300 hover:shadow">
                <span className="text-3xl">{c.icon || "💍"}</span>
                <span className="text-sm font-medium">{lang === "rw" && c.nameRw ? c.nameRw : c.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Plan + recommendations */}
        <section className="card p-6">
          <h2 className="text-2xl font-semibold">{t("home.plan")}</h2>
          <p className="muted mt-1">{t("home.planHelp")}</p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedPlan(plan);
            }}
          >
            <div>
              <label className="label">{t("field.date")}</label>
              <input type="date" min={kigaliToday()} className="input" value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("field.district")}</label>
              <select className="input" value={plan.district} onChange={(e) => setPlan({ ...plan, district: e.target.value })}>
                <option value="">—</option>
                {(cats?.districts || []).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("field.budget")}</label>
              <input type="number" min={0} className="input" value={plan.budget} onChange={(e) => setPlan({ ...plan, budget: e.target.value })} />
            </div>
            <div className="flex items-end">
              <button className="btn-primary w-full">{t("action.suggest")}</button>
            </div>
          </form>
        </section>

        <section>
          <SectionTitle title={t("home.recommended")} />
          {recsLoading ? <GridSkeleton /> : <ServiceGrid services={recs?.recommendations || []} />}
          {recs?.missingCategories && recs.missingCategories.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-600">Still to book:</span>
              {recs.missingCategories.slice(0, 6).map((slug) => (
                <Link key={slug} href={`/services?category=${slug}${effectivePlan.date ? `&date=${effectivePlan.date}` : ""}`} className="badge bg-brand-50 text-brand-800 hover:bg-brand-100">
                  {cats?.categories.find((c) => c.slug === slug)?.name || slug}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: CalendarCheck, title: t("home.how.1.title"), text: t("home.how.1.text") },
            { icon: HandCoins, title: t("home.how.2.title"), text: t("home.how.2.text") },
            { icon: PartyPopper, title: t("home.how.3.title"), text: t("home.how.3.text") },
          ].map((s, i) => (
            <div key={i} className="card p-6">
              <s.icon className="text-brand-700" />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{s.text}</p>
            </div>
          ))}
        </section>

        {providers && providers.length > 0 && (
          <section>
            <SectionTitle title={t("home.topProviders")} href="/providers" cta={t("action.viewAll")} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => (
                <Link key={p.id} href={`/providers/${p.sellerId}`} className="card flex items-center gap-4 p-4 hover:shadow">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-brand-100">
                    {p.avatar?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar.url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xl font-bold text-brand-700">{p.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-stone-500">
                      {cats?.categories.find((c) => c.slug === p.category)?.name} · {p.district}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <Stars value={p.ratings} count={p.reviewCount} />
                      {p.completedCount > 0 && <span className="text-xs text-stone-500">{p.completedCount} {t("common.weddings")}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle title={t("home.latest")} href="/services?sort=newest" cta={t("action.viewAll")} />
          {latestLoading ? <GridSkeleton /> : <ServiceGrid services={latest || []} />}
        </section>

        <SafetyNotice />
      </div>
    </div>
  );
}
