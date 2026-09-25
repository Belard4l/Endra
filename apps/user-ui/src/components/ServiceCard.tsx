"use client";
import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import { rwf } from "@/lib/format";
import type { ServiceCardData } from "@/lib/types";
import { useStore } from "@/store";
import { track } from "@/hooks/useTrack";
import { Stars } from "./ui";
import { useI18n } from "@/lib/i18n";

const ServiceCard = ({ service }: { service: ServiceCardData }) => {
  const { t } = useI18n();
  const saved = useStore((s) => s.saved.some((x) => x.id === service.id));
  const toggleSaved = useStore((s) => s.toggleSaved);
  const image = service.images?.[0]?.url;

  const onSave = (e: React.MouseEvent) => {
    e.preventDefault();
    const nowSaved = toggleSaved({ id: service.id, slug: service.slug, title: service.title, image, basePrice: service.basePrice, category: service.category });
    track(nowSaved ? "save" : "unsave", service.id);
  };

  return (
    <Link href={`/services/${service.slug}`} className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] bg-stone-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={service.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">💍</div>
        )}
        <button
          onClick={onSave}
          aria-label={saved ? t("action.saved") : t("action.save")}
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow hover:bg-white"
        >
          <Heart size={18} className={saved ? "fill-brand-600 text-brand-600" : "text-stone-700"} />
        </button>
      </div>
      <div className="space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium uppercase tracking-wide text-brand-700">{service.shop?.name || service.category}</span>
          <Stars value={service.ratings} count={service.reviewCount} />
        </div>
        <h3 className="line-clamp-1 font-semibold group-hover:text-brand-700">{service.title}</h3>
        <p className="line-clamp-2 text-sm text-stone-500">{service.shortDescription}</p>
        {service.reasons && service.reasons.length > 0 && (
          <p className="text-xs font-medium text-emerald-700">✓ {service.reasons[0]}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm">
            <span className="text-stone-500">{t("common.from")} </span>
            <span className="font-bold">{rwf(service.basePrice)}</span>
          </p>
          {service.shop?.district && (
            <span className="flex items-center gap-1 text-xs text-stone-500">
              <MapPin size={12} /> {service.shop.district}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ServiceCard;

export const ServiceGrid = ({ services }: { services: ServiceCardData[] }) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {services.map((s) => (
      <ServiceCard key={s.id} service={s} />
    ))}
  </div>
);
