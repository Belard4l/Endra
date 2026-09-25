"use client";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { ServiceGrid } from "@/components/ServiceCard";
import { Empty, Pagination, Skeleton } from "@/components/ui";
import { kigaliToday } from "@/lib/format";
import type { ServiceCardData } from "@/lib/types";

const SORTS = ["recommended", "price_asc", "price_desc", "rating", "newest"] as const;

function Browse() {
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: cats } = useCategories();
  const [showFilters, setShowFilters] = useState(false);

  const current = {
    q: params.get("q") || "",
    category: params.get("category") || "",
    district: params.get("district") || "",
    date: params.get("date") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    sort: params.get("sort") || "recommended",
    page: Number(params.get("page") || 1),
  };
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [params.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (next: Partial<typeof current>) => {
    const merged = { ...current, ...next };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v && !(k === "page" && v === 1) && !(k === "sort" && v === "recommended")) sp.set(k, String(v));
    });
    router.push(`${pathname}?${sp.toString()}`);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["services", params.toString()],
    queryFn: async () => {
      const sp = new URLSearchParams(params.toString());
      sp.set("limit", "12");
      return (await api.get(`/catalog/api/services?${sp}`)).data as { services: ServiceCardData[]; total: number; page: number; pages: number };
    },
  });

  const categoryTitle = current.category ? cats?.categories.find((c) => c.slug === current.category) : null;

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">
            {categoryTitle ? (lang === "rw" && categoryTitle.nameRw ? categoryTitle.nameRw : categoryTitle.name) : t("nav.services")}
          </h1>
          <p className="muted mt-1">
            {data ? `${data.total} result${data.total === 1 ? "" : "s"}` : t("common.loading")}
            {current.q && ` for “${current.q}”`}
            {current.date && ` · free on ${current.date}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline lg:hidden" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={16} /> {t("filters.title")}
          </button>
          <select className="input w-auto" value={current.sort} onChange={(e) => push({ sort: e.target.value, page: 1 })}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}` as any)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className={`${showFilters ? "block" : "hidden"} lg:block`}>
          <form
            className="card sticky top-20 space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              push({ ...draft, page: 1 });
              setShowFilters(false);
            }}
          >
            <div>
              <label className="label">Keyword</label>
              <input className="input" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("filters.category")}</label>
              <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option value="">{t("filters.all")}</option>
                {cats?.categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {lang === "rw" && c.nameRw ? c.nameRw : c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("field.date")}</label>
              <input type="date" min={kigaliToday()} className="input" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              <p className="mt-1 text-xs text-stone-500">Only show providers free that day</p>
            </div>
            <div>
              <label className="label">{t("field.district")}</label>
              <select className="input" value={draft.district} onChange={(e) => setDraft({ ...draft, district: e.target.value })}>
                <option value="">{t("filters.all")}</option>
                {cats?.districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("filters.price")}</label>
              <div className="flex gap-2">
                <input type="number" min={0} placeholder="Min" className="input" value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} />
                <input type="number" min={0} placeholder="Max" className="input" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1">{t("filters.apply")}</button>
              <button type="button" className="btn-ghost" onClick={() => router.push(pathname || "/services")}>
                {t("filters.clear")}
              </button>
            </div>
          </form>
        </aside>

        <section>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72" />
              ))}
            </div>
          ) : data && data.services.length > 0 ? (
            <>
              <div className="[&>div]:xl:grid-cols-3">
                <ServiceGrid services={data.services} />
              </div>
              <Pagination page={data.page} pages={data.pages} onChange={(p) => push({ page: p })} />
            </>
          ) : (
            <Empty title="No services match your filters" text="Try another date, district or price range." />
          )}
        </section>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="container-x py-8">Loading…</div>}>
      <Browse />
    </Suspense>
  );
}
