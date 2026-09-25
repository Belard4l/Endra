"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BadgeCheck, CalendarDays, Check, Clock, Heart, MapPin, MessageCircleQuestion, ShoppingBag, X } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatDate, kigaliToday, rwf } from "@/lib/format";
import type { Service, ServiceCardData } from "@/lib/types";
import { useStore } from "@/store";
import { track } from "@/hooks/useTrack";
import useUser from "@/hooks/useUser";
import { categoryName, useCategories } from "@/hooks/useCategories";
import { ServiceGrid } from "@/components/ServiceCard";
import { Empty, PageLoader, SafetyNotice, Stars } from "@/components/ui";
import OptionPicker from "@/components/OptionPicker";

type Detail = {
  service: Service;
  shop: any;
  provider: { id: string; completedCount: number; memberSince: string; verified: boolean; accountType: string };
  related: ServiceCardData[];
};

const Gallery = ({ images, title }: { images: { url: string }[]; title: string }) => {
  const [active, setActive] = useState(0);
  if (!images.length) return <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-stone-100 text-6xl">💍</div>;
  return (
    <div>
      <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[active]?.url} alt={title} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button key={i} onClick={() => setActive(i)} className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? "border-brand-600" : "border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const QuestionsSection = ({ serviceId }: { serviceId: string }) => {
  const { user } = useUser();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data } = useQuery({
    queryKey: ["questions", serviceId],
    queryFn: async () => (await api.get(`/catalog/api/services/${serviceId}/questions`)).data.questions as any[],
  });
  const ask = useMutation({
    mutationFn: async () => api.post(`/catalog/api/services/${serviceId}/questions`, { question: text }),
    onSuccess: () => {
      setText("");
      toast.success("Question posted. The provider will answer publicly.");
      qc.invalidateQueries({ queryKey: ["questions", serviceId] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section id="questions" className="card p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <MessageCircleQuestion className="text-brand-700" /> Questions & answers
      </h2>
      <p className="muted mt-1">
        Ask the provider anything before booking. Questions and answers are public, and contact details are not allowed — chat opens on your wedding day.
      </p>
      {user ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            ask.mutate();
          }}
        >
          <input className="input flex-1" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Do you travel to Musanze? Is the menu halal?" />
          <button className="btn-primary" disabled={ask.isPending || text.trim().length < 5}>
            Ask
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm">
          <Link href="/login" className="font-semibold text-brand-700">
            Sign in
          </Link>{" "}
          to ask a question.
        </p>
      )}
      <div className="mt-5 divide-y divide-stone-100">
        {(data || []).length === 0 && <p className="py-3 text-sm text-stone-500">No questions yet.</p>}
        {(data || []).map((q) => (
          <div key={q.id} className="py-4">
            <p className="text-sm">
              <span className="font-semibold">Q ({q.userName}):</span> {q.question}
            </p>
            {q.answer ? (
              <p className="mt-1 text-sm text-stone-700">
                <span className="font-semibold text-brand-700">A:</span> {q.answer}
              </p>
            ) : (
              <p className="mt-1 text-xs text-stone-400">Waiting for the provider's answer</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { data: cats } = useCategories();
  const addToBasket = useStore((s) => s.addToBasket);
  const toggleSaved = useStore((s) => s.toggleSaved);
  const saved = useStore((s) => s.saved);

  const { data, isLoading, error } = useQuery({
    queryKey: ["service", slug],
    queryFn: async () => (await api.get(`/catalog/api/services/${slug}`)).data as Detail,
  });
  const service = data?.service;

  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null);

  // Pre-select the first choice of required single-choice groups
  useEffect(() => {
    if (!service) return;
    const init: Record<string, string[]> = {};
    service.optionGroups.forEach((g) => {
      if (g.required && g.type === "single" && g.choices[0]) init[g.id] = [g.choices[0].id];
    });
    setSelections(init);
  }, [service?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectionPayload = useMemo(() => Object.entries(selections).map(([groupId, choiceIds]) => ({ groupId, choiceIds })), [selections]);

  const { data: quote, error: quoteError } = useQuery({
    queryKey: ["quote", service?.id, selectionPayload, district],
    enabled: Boolean(service),
    queryFn: async () =>
      (await api.post(`/catalog/api/services/${service!.id}/quote`, { selections: selectionPayload, eventDistrict: district || undefined })).data as {
        price: number;
        travelFee: number;
        optionsTotal: number;
        bookingFee: number;
        depositPercent: number;
      },
    retry: false,
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", service?.id],
    enabled: Boolean(service),
    queryFn: async () => (await api.get(`/catalog/api/services/${service!.id}/reviews`)).data.reviews as any[],
  });
  const { data: alsoBooked } = useQuery({
    queryKey: ["also", service?.id],
    enabled: Boolean(service),
    queryFn: async () => (await api.get(`/catalog/api/services/${service!.id}/also-booked`)).data.services as ServiceCardData[],
  });

  const checkDate = async (d: string) => {
    setDate(d);
    setAvailability(null);
    if (!d || !service) return;
    try {
      const res = await api.get(`/catalog/api/services/${service.id}/availability?date=${d}`);
      setAvailability(res.data);
    } catch (e) {
      setAvailability({ available: false, reason: errorMessage(e) });
    }
  };

  if (isLoading) return <PageLoader />;
  if (error || !service || !data) {
    return (
      <div className="container-x py-16">
        <Empty title="Service not found" text="It may have been removed or is temporarily unavailable." action={<Link href="/services" className="btn-primary">Browse services</Link>} />
      </div>
    );
  }

  const isSaved = saved.some((s) => s.id === service.id);
  const labels = service.optionGroups.flatMap((g) => g.choices.filter((c) => (selections[g.id] || []).includes(c.id)).map((c) => `${g.name}: ${c.label}`));
  const missingRequired = service.optionGroups.filter((g) => g.required && !(selections[g.id] || []).length);

  const onAdd = () => {
    if (!date) return toast.error("Choose your event date");
    if (!availability?.available) return toast.error(availability?.reason || "Check the date first");
    if (missingRequired.length) return toast.error(`Choose: ${missingRequired.map((g) => g.name).join(", ")}`);
    addToBasket({
      serviceId: service.id,
      slug: service.slug,
      title: service.title,
      image: service.images[0]?.url,
      category: service.category,
      sellerId: service.sellerId,
      shopName: data.shop?.name,
      eventDate: date,
      startTime,
      selections: selectionPayload,
      selectionLabels: labels,
      price: quote?.price ?? service.basePrice,
      notes,
    });
    track("add_to_basket", service.id);
    toast.success("Added to your basket");
    router.push("/basket");
  };

  return (
    <div className="container-x py-8">
      <nav className="mb-4 text-sm text-stone-500">
        <Link href="/services">{t("nav.services")}</Link> /{" "}
        <Link href={`/services?category=${service.category}`}>{categoryName(cats?.categories, service.category, lang)}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <Gallery images={service.images} title={service.title} />

          <div>
            <h1 className="text-3xl font-semibold">{service.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-stone-600">
              <Stars value={service.ratings} count={service.reviewCount} />
              {service.durationHours && (
                <span className="flex items-center gap-1">
                  <Clock size={14} /> {service.durationHours} hours
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin size={14} /> Serves {service.serviceArea.join(", ")}
              </span>
            </div>
            <p className="mt-4 text-lg text-stone-700">{service.shortDescription}</p>
            <div className="prose mt-4 max-w-none whitespace-pre-line text-stone-700">{service.description}</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <h3 className="font-semibold">What's included</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {service.included.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold">Not included</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {service.excluded.length === 0 && <li className="text-stone-500">Nothing listed</li>}
                {service.excluded.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <X size={16} className="mt-0.5 shrink-0 text-stone-400" /> {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card space-y-4 p-5 text-sm">
            <div>
              <h3 className="font-semibold">Requirements</h3>
              <p className="mt-1 whitespace-pre-line text-stone-700">{service.requirements}</p>
            </div>
            <div>
              <h3 className="font-semibold">Service area & travel</h3>
              <p className="mt-1 text-stone-700">
                Base price covers {service.serviceArea.join(", ")}.{" "}
                {service.travelFee > 0 ? `Other districts: +${rwf(service.travelFee)} travel fee.` : "Does not travel to other districts."}
              </p>
            </div>
            {service.culturalOptions && (
              <div>
                <h3 className="font-semibold">Cultural & dietary options</h3>
                <p className="mt-1 whitespace-pre-line text-stone-700">{service.culturalOptions}</p>
              </div>
            )}
            {service.extraTerms && (
              <div>
                <h3 className="font-semibold">Provider terms</h3>
                <p className="mt-1 whitespace-pre-line text-stone-700">{service.extraTerms}</p>
              </div>
            )}
            <div>
              <h3 className="font-semibold">Cancellation policy</h3>
              <p className="mt-1 text-stone-700">
                More than 90 days before: full refund · 30–90 days: 50% · under 30 days: no refund. One free reschedule if the provider is available.{" "}
                <Link href="/how-it-works#policies" className="text-brand-700 underline">
                  Details
                </Link>
              </p>
            </div>
          </div>

          <QuestionsSection serviceId={service.id} />

          <section className="card p-6">
            <h2 className="text-xl font-semibold">Reviews</h2>
            <p className="muted">Only couples who booked and received this service through HUZA can review it.</p>
            <div className="mt-4 divide-y divide-stone-100">
              {(reviews || []).length === 0 && <p className="py-3 text-sm text-stone-500">No reviews yet.</p>}
              {(reviews || []).map((r) => (
                <div key={r.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.userName}</span>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-stone-700">{r.comment}</p>}
                  <p className="mt-1 text-xs text-stone-400">{formatDate(r.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Booking panel */}
        <aside className="space-y-4">
          <div className="card sticky top-20 space-y-4 p-5">
            <div className="flex items-baseline justify-between">
              <p>
                <span className="text-2xl font-bold">{rwf(quote?.price ?? service.basePrice)}</span>
                <span className="text-sm text-stone-500"> {service.priceUnit}</span>
              </p>
              <button
                className="rounded-full p-2 hover:bg-stone-100"
                onClick={() => {
                  const now = toggleSaved({ id: service.id, slug: service.slug, title: service.title, image: service.images[0]?.url, basePrice: service.basePrice, category: service.category });
                  track(now ? "save" : "unsave", service.id);
                }}
                aria-label="Save"
              >
                <Heart className={isSaved ? "fill-brand-600 text-brand-600" : ""} />
              </button>
            </div>

            {service.optionGroups.length > 0 && <OptionPicker groups={service.optionGroups} value={selections} onChange={setSelections} />}

            <div>
              <label className="label flex items-center gap-1">
                <CalendarDays size={14} /> {t("field.date")}
              </label>
              <input type="date" min={kigaliToday()} className="input" value={date} onChange={(e) => checkDate(e.target.value)} />
              {availability && (
                <p className={`mt-1 text-sm ${availability.available ? "text-emerald-700" : "text-red-600"}`}>
                  {availability.available ? "✓ Available on this date" : availability.reason}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("field.startTime")}</label>
                <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("field.district")}</label>
                <select className="input" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  <option value="">—</option>
                  {cats?.districts.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            {quoteError && <p className="text-sm text-red-600">{errorMessage(quoteError)}</p>}
            <div>
              <label className="label">{t("field.notes")}</label>
              <textarea className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Theme, colours, number of guests…" />
            </div>

            {quote && (
              <div className="space-y-1 rounded-xl bg-stone-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Base price</span>
                  <span>{rwf(service.basePrice)}</span>
                </div>
                {quote.optionsTotal !== 0 && (
                  <div className="flex justify-between">
                    <span>Options</span>
                    <span>{rwf(quote.optionsTotal)}</span>
                  </div>
                )}
                {quote.travelFee > 0 && (
                  <div className="flex justify-between">
                    <span>Travel fee</span>
                    <span>{rwf(quote.travelFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-500">
                  <span>{t("basket.bookingFee")}</span>
                  <span>{rwf(quote.bookingFee)}</span>
                </div>
                <p className="pt-1 text-xs text-stone-500">Pay in full, or a {quote.depositPercent}% deposit now and the rest later.</p>
              </div>
            )}

            <button onClick={onAdd} className="btn-primary w-full py-3" disabled={!!quoteError}>
              <ShoppingBag size={18} /> {t("action.addToBasket")}
            </button>
            <SafetyNotice compact />
          </div>

          {data.shop && (
            <Link href={`/providers/${data.shop.sellerId}`} className="card flex items-center gap-3 p-4 hover:shadow">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-brand-100">
                {data.shop.avatar?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.shop.avatar.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center font-bold text-brand-700">{data.shop.name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate font-semibold">
                  {data.shop.name} {data.provider.verified && <BadgeCheck size={16} className="text-sky-600" />}
                </p>
                <p className="text-xs text-stone-500">
                  {data.provider.completedCount} {t("common.weddings")} · {data.shop.district}
                </p>
              </div>
            </Link>
          )}
        </aside>
      </div>

      {alsoBooked && alsoBooked.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-2xl font-semibold">Couples who booked this also booked</h2>
          <ServiceGrid services={alsoBooked} />
        </section>
      )}
      {data.related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-2xl font-semibold">Similar services</h2>
          <ServiceGrid services={data.related} />
        </section>
      )}
    </div>
  );
}
