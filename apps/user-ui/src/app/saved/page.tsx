"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useStore } from "@/store";
import { rwf } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Empty } from "@/components/ui";

export default function SavedPage() {
  const { t } = useI18n();
  const saved = useStore((s) => s.saved);
  const toggle = useStore((s) => s.toggleSaved);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-3xl font-semibold">{t("nav.saved")}</h1>
      {saved.length === 0 ? (
        <Empty title="Nothing saved yet" text="Tap the heart on any service to keep it here." action={<Link href="/services" className="btn-primary">{t("hero.cta")}</Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((s) => (
            <div key={s.id} className="card flex gap-3 p-3">
              <Link href={`/services/${s.slug}`} className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl">💍</div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/services/${s.slug}`} className="line-clamp-2 font-semibold hover:underline">{s.title}</Link>
                <p className="text-sm">{t("common.from")} {rwf(s.basePrice)}</p>
              </div>
              <button onClick={() => toggle(s)} className="self-start p-1" aria-label="Remove">
                <Heart className="fill-brand-600 text-brand-600" size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
