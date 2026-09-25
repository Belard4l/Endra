"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { Empty, Pagination, Skeleton, Stars } from "@/components/ui";

function Providers() {
  const { t, lang } = useI18n();
  const { data: cats } = useCategories();
  const [category, setCategory] = useState("");
  const [district, setDistrict] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["providers", category, district, page],
    queryFn: async () => (await api.get(`/catalog/api/providers?page=${page}&category=${category}&district=${district}`)).data,
  });
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-semibold">{t("nav.providers")}</h1>
      <p className="muted mt-1">Verified providers, ranked by weddings delivered, reviews and reliability.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <select className="input w-auto" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">{t("filters.all")}</option>
          {cats?.categories.map((c) => (
            <option key={c.slug} value={c.slug}>{lang === "rw" && c.nameRw ? c.nameRw : c.name}</option>
          ))}
        </select>
        <select className="input w-auto" value={district} onChange={(e) => { setDistrict(e.target.value); setPage(1); }}>
          <option value="">{t("field.district")}: {t("filters.all")}</option>
          {cats?.districts.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        {data?.providers.map((p: any) => (
          <Link key={p.id} href={`/providers/${p.sellerId}`} className="card overflow-hidden transition hover:shadow-lg">
            <div className="h-28 bg-gradient-to-r from-brand-700 to-brand-500">
              {p.coverBanner?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverBanner.url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="-mt-8 p-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border-4 border-white bg-brand-100">
                {p.avatar?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-xl font-bold text-brand-700">{p.name.charAt(0)}</span>
                )}
              </div>
              <p className="mt-2 flex items-center gap-1 font-semibold">{p.name} <BadgeCheck size={16} className="text-sky-600" /></p>
              <p className="text-xs text-stone-500">{cats?.categories.find((c) => c.slug === p.category)?.name} · {p.district}</p>
              <div className="mt-2 flex items-center gap-3">
                <Stars value={p.ratings} count={p.reviewCount} />
                <span className="text-xs text-stone-500">{p.completedCount} {t("common.weddings")}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {data && data.providers.length === 0 && <Empty title="No providers found" />}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </div>
  );
}

export default function ProvidersPage() {
  return (
    <Suspense fallback={null}>
      <Providers />
    </Suspense>
  );
}
