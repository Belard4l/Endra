"use client";
/**
 * Listing editor — the required template (5) plus pricing options (4):
 * guest-count tiers, hours, add-ons… defined here and picked by couples when
 * they add the service to their basket.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { fileToDataUrl, rwf } from "@/lib/format";
import { useCategories } from "@/hooks/useCategories";
import type { OptionGroup } from "@/lib/types";
import OptionPicker from "./OptionPicker";
import { Spinner } from "./ui";

type ImageItem = { fileId?: string; url: string; data?: string };

export type ServiceFormValues = {
  title: string;
  category: string;
  shortDescription: string;
  description: string;
  basePrice: string;
  priceUnit: string;
  durationHours: string;
  serviceArea: string[];
  travelFee: string;
  included: string[];
  excluded: string[];
  requirements: string;
  culturalOptions: string;
  extraTerms: string;
  tags: string;
  optionGroups: OptionGroup[];
  images: ImageItem[];
};

export const emptyService = (category = ""): ServiceFormValues => ({
  title: "",
  category,
  shortDescription: "",
  description: "",
  basePrice: "",
  priceUnit: "per event",
  durationHours: "",
  serviceArea: [],
  travelFee: "0",
  included: [""],
  excluded: [""],
  requirements: "",
  culturalOptions: "",
  extraTerms: "",
  tags: "",
  optionGroups: [],
  images: [],
});

export const fromService = (s: any): ServiceFormValues => ({
  title: s.title,
  category: s.category,
  shortDescription: s.shortDescription,
  description: s.description,
  basePrice: String(s.basePrice),
  priceUnit: s.priceUnit,
  durationHours: s.durationHours ? String(s.durationHours) : "",
  serviceArea: s.serviceArea,
  travelFee: String(s.travelFee || 0),
  included: s.included.length ? s.included : [""],
  excluded: s.excluded.length ? s.excluded : [""],
  requirements: s.requirements,
  culturalOptions: s.culturalOptions || "",
  extraTerms: s.extraTerms || "",
  tags: (s.tags || []).join(", "),
  optionGroups: s.optionGroups || [],
  images: s.images,
});

const uid = () => Math.random().toString(36).slice(2, 10);
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

const ListEditor = ({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) => (
  <div>
    <label className="label">{label}</label>
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input className="input" value={it} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="btn-ghost px-2" onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : [""])}>
            <X size={16} />
          </button>
        </div>
      ))}
      <button type="button" className="text-sm font-medium text-brand-700" onClick={() => onChange([...items, ""])}>+ Add another</button>
    </div>
  </div>
);

const ServiceForm = ({ initial, serviceId }: { initial: ServiceFormValues; serviceId?: string }) => {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: cats } = useCategories();
  const [v, setV] = useState<ServiceFormValues>(initial);
  const [preview, setPreview] = useState<Record<string, string[]>>({});
  const set = <K extends keyof ServiceFormValues>(k: K, val: ServiceFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const save = useMutation({
    mutationFn: async (status: "draft" | "published") => {
      const payload = {
        ...v,
        basePrice: Number(v.basePrice),
        travelFee: Number(v.travelFee || 0),
        durationHours: v.durationHours ? Number(v.durationHours) : null,
        included: v.included.map((x) => x.trim()).filter(Boolean),
        excluded: v.excluded.map((x) => x.trim()).filter(Boolean),
        tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
        images: v.images.map((img) => (img.data ? img.data : { fileId: img.fileId, url: img.url })),
        status,
      };
      return serviceId ? api.put(`/catalog/api/seller/services/${serviceId}`, payload) : api.post("/catalog/api/seller/services", payload);
    },
    onSuccess: (_r, status) => {
      toast.success(status === "published" ? "Listing published" : "Saved as draft");
      qc.invalidateQueries({ queryKey: ["my-services"] });
      router.push("/services");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const room = 8 - v.images.length;
    const list = Array.from(files).slice(0, room);
    for (const f of list) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} is larger than 5 MB`);
        continue;
      }
      const data = await fileToDataUrl(f);
      setV((p) => ({ ...p, images: [...p.images, { url: data, data }] }));
    }
  };

  const updateGroup = (gi: number, patch: Partial<OptionGroup>) => set("optionGroups", v.optionGroups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input className="input" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Full-day wedding photography & video" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={v.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Choose…</option>
              {cats?.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Duration (hours, optional)</label>
            <input type="number" min={1} className="input" value={v.durationHours} onChange={(e) => set("durationHours", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Short description ({words(v.shortDescription)}/40 words)</label>
            <input className="input" value={v.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Detailed description ({words(v.description)} words, min 50)</label>
            <textarea className="input" rows={7} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe your service, style, experience, what the day looks like…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Tags (comma separated, optional)</label>
            <input className="input" value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder="outdoor, traditional, drone" />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Photos ({v.images.length}/8)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {v.images.map((img, i) => (
            <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="badge absolute left-2 top-2 bg-white text-stone-800">Cover</span>}
              <button type="button" onClick={() => set("images", v.images.filter((_, j) => j !== i))} className="absolute right-2 top-2 rounded-full bg-white/90 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {v.images.length < 8 && (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 text-sm text-stone-500 hover:bg-stone-50">
              <ImagePlus /> Add photos
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
            </label>
          )}
        </div>
        <p className="text-xs text-stone-500">Photos with phone numbers, logos with contact details or watermarked social handles may be removed.</p>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold">What couples need to know</h2>
        <p className="muted -mt-2">Couples can't chat with you before the wedding day, so answer the usual questions here.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ListEditor label="What's included" items={v.included} onChange={(x) => set("included", x)} placeholder="e.g. 300 edited photos" />
          <ListEditor label="Not included" items={v.excluded} onChange={(x) => set("excluded", x)} placeholder="e.g. Printed album" />
        </div>
        <div>
          <label className="label">Requirements</label>
          <textarea className="input" rows={3} value={v.requirements} onChange={(e) => set("requirements", e.target.value)} placeholder="Setup time, power, space, meals for staff…" />
        </div>
        <div>
          <label className="label">Cultural / dietary options (optional)</label>
          <textarea className="input" rows={2} value={v.culturalOptions} onChange={(e) => set("culturalOptions", e.target.value)} placeholder="e.g. Gusaba & Gukwa ceremonies, halal menu, vegetarian options" />
        </div>
        <div>
          <label className="label">Your extra terms (optional)</label>
          <textarea className="input" rows={2} value={v.extraTerms} onChange={(e) => set("extraTerms", e.target.value)} placeholder="Anything else couples should agree to. HUZA's cancellation policy always applies." />
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Area & price</h2>
        <div>
          <label className="label">Districts you serve at the base price</label>
          <div className="flex flex-wrap gap-2">
            {cats?.districts.map((d) => {
              const on = v.serviceArea.includes(d);
              return (
                <button type="button" key={d} onClick={() => set("serviceArea", on ? v.serviceArea.filter((x) => x !== d) : [...v.serviceArea, d])} className={`rounded-full border px-3 py-1 text-sm ${on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-stone-300"}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Base price (RWF)</label>
            <input type="number" min={1000} className="input" value={v.basePrice} onChange={(e) => set("basePrice", e.target.value)} />
          </div>
          <div>
            <label className="label">Price unit</label>
            <input className="input" value={v.priceUnit} onChange={(e) => set("priceUnit", e.target.value)} />
          </div>
          <div>
            <label className="label">Travel fee outside your area</label>
            <input type="number" min={0} className="input" value={v.travelFee} onChange={(e) => set("travelFee", e.target.value)} />
            <p className="mt-1 text-xs text-stone-500">0 = you don't travel outside the districts above</p>
          </div>
        </div>
        {v.basePrice && (
          <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
            For a {rwf(Number(v.basePrice))} booking you receive about <strong>{rwf(Number(v.basePrice) * 0.965 * 0.85)}</strong> (85% after a ~3.5% MoMo processing fee), paid the Thursday after delivery.
          </p>
        )}
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pricing options</h2>
            <p className="muted">Guest tiers, hours of coverage, add-ons… Couples choose these when booking. Price changes can be negative.</p>
          </div>
          <button type="button" className="btn-outline" onClick={() => set("optionGroups", [...v.optionGroups, { id: uid(), name: "", type: "single", required: false, choices: [{ id: uid(), label: "", priceDelta: 0 }] }])}>
            <Plus size={16} /> Add option group
          </button>
        </div>
        {v.optionGroups.map((g, gi) => (
          <div key={g.id} className="rounded-xl border border-stone-200 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <input className="input" placeholder="Group name, e.g. Number of guests" value={g.name} onChange={(e) => updateGroup(gi, { name: e.target.value })} />
              <select className="input" value={g.type} onChange={(e) => updateGroup(gi, { type: e.target.value as any })}>
                <option value="single">Pick one</option>
                <option value="multiple">Pick any</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={g.required} onChange={(e) => updateGroup(gi, { required: e.target.checked })} /> Required
              </label>
              <button type="button" className="btn-ghost text-red-600" onClick={() => set("optionGroups", v.optionGroups.filter((_, i) => i !== gi))}><Trash2 size={16} /></button>
            </div>
            <div className="mt-3 space-y-2">
              {g.choices.map((c, ci) => (
                <div key={c.id} className="grid grid-cols-[1fr_160px_auto] gap-2">
                  <input className="input" placeholder="Choice, e.g. 200 guests" value={c.label} onChange={(e) => updateGroup(gi, { choices: g.choices.map((x, j) => (j === ci ? { ...x, label: e.target.value } : x)) })} />
                  <input type="number" className="input" placeholder="+/- RWF" value={c.priceDelta} onChange={(e) => updateGroup(gi, { choices: g.choices.map((x, j) => (j === ci ? { ...x, priceDelta: Number(e.target.value) } : x)) })} />
                  <button type="button" className="btn-ghost px-2" onClick={() => updateGroup(gi, { choices: g.choices.length > 1 ? g.choices.filter((_, j) => j !== ci) : g.choices })}><X size={16} /></button>
                </div>
              ))}
              <button type="button" className="text-sm font-medium text-brand-700" onClick={() => updateGroup(gi, { choices: [...g.choices, { id: uid(), label: "", priceDelta: 0 }] })}>+ Add choice</button>
            </div>
          </div>
        ))}
        {v.optionGroups.length > 0 && v.optionGroups.every((g) => g.name && g.choices.every((c) => c.label)) && (
          <div className="rounded-xl bg-stone-50 p-4">
            <p className="mb-2 text-sm font-semibold">Preview (what couples see)</p>
            <OptionPicker groups={v.optionGroups} value={preview} onChange={setPreview} />
          </div>
        )}
      </section>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-stone-200 bg-sand/95 py-4 backdrop-blur">
        <button type="button" className="btn-outline" disabled={save.isPending} onClick={() => save.mutate("draft")}>Save draft</button>
        <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => save.mutate("published")}>
          {save.isPending ? <Spinner /> : "Publish"}
        </button>
      </div>
    </form>
  );
};

export default ServiceForm;
