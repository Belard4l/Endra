"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, Globe, MapPin } from "lucide-react";
import api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { formatDate } from "@/lib/format";
import { ServiceGrid } from "@/components/ServiceCard";
import { Empty, PageLoader, Stars } from "@/components/ui";

export default function ProviderPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { data: cats } = useCategories();
  const { data, isLoading } = useQuery({
    queryKey: ["provider", id],
    queryFn: async () => (await api.get(`/catalog/api/providers/${id}`)).data,
  });
  if (isLoading) return <PageLoader />;
  if (!data) return <div className="container-x py-12"><Empty title="Provider not found" /></div>;
  const { shop, provider, services, reviews } = data;
  return (
    <div>
      <div className="h-48 bg-gradient-to-r from-brand-800 to-brand-500 sm:h-64">
        {shop.coverBanner?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.coverBanner.url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="container-x">
        <div className="-mt-12 flex flex-wrap items-end gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-brand-100">
            {shop.avatar?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.avatar.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-3xl font-bold text-brand-700">{shop.name.charAt(0)}</span>
            )}
          </div>
          <div className="pb-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              {shop.name} {provider.verified && <BadgeCheck className="text-sky-600" />}
            </h1>
            <p className="text-sm text-stone-500">{cats?.categories.find((c) => c.slug === shop.category)?.name}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[300px_1fr]">
          <aside className="card h-fit space-y-3 p-5 text-sm">
            <Stars value={shop.ratings} count={shop.reviewCount} />
            <p>{provider.completedCount} {t("common.weddings")}</p>
            {shop.bio && <p className="text-stone-700">{shop.bio}</p>}
            <p className="flex items-center gap-2"><MapPin size={14} /> {shop.district}</p>
            {shop.openHours && <p className="flex items-center gap-2"><Clock size={14} /> {shop.openHours}</p>}
            {shop.website && <p className="flex items-center gap-2"><Globe size={14} /> Website available after booking</p>}
            <p className="text-xs text-stone-400">On HUZA since {formatDate(provider.memberSince)}</p>
          </aside>
          <div className="space-y-10">
            <section>
              <h2 className="mb-4 text-xl font-semibold">Services</h2>
              {services.length ? <ServiceGrid services={services} /> : <Empty title="No services listed yet" />}
            </section>
            <section>
              <h2 className="mb-4 text-xl font-semibold">Reviews</h2>
              <div className="card divide-y divide-stone-100">
                {reviews.length === 0 && <p className="p-5 text-sm text-stone-500">No reviews yet.</p>}
                {reviews.map((r: any) => (
                  <div key={r.id} className="p-5">
                    <div className="flex justify-between"><span className="font-medium">{r.userName}</span><Stars value={r.rating} /></div>
                    {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                    <p className="mt-1 text-xs text-stone-400">{formatDate(r.createdAt)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
