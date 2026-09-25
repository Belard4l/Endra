"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FileCheck2, Upload } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { fileToDataUrl } from "@/lib/format";
import { useCategories } from "@/hooks/useCategories";
import type { Seller } from "@/hooks/useSeller";
import { Spinner } from "./ui";

const refreshSeller = async (qc: ReturnType<typeof useQueryClient>) => {
  const { data } = await api.get("/auth/api/logged-in-seller");
  qc.setQueryData(["seller"], data.seller);
  return data.seller as Seller;
};

// ───── Step 2: business profile ─────
export const BusinessForm = ({ seller, onDone, submitLabel = "Save & continue" }: { seller: Seller | null; onDone?: () => void; submitLabel?: string }) => {
  const qc = useQueryClient();
  const { data: cats } = useCategories();
  const shop = seller?.shop;
  const [f, setF] = useState({ name: "", category: "", district: "", address: "", bio: "", openHours: "", website: "" });
  useEffect(() => {
    if (shop)
      setF({
        name: shop.name || "",
        category: shop.category || "",
        district: shop.district || "",
        address: shop.address || "",
        bio: shop.bio || "",
        openHours: shop.openHours || "",
        website: shop.website || "",
      });
  }, [shop?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = f.bio.trim() ? f.bio.trim().split(/\s+/).length : 0;
  const save = useMutation({
    mutationFn: async () => api.post("/auth/api/create-shop", f),
    onSuccess: async () => {
      await refreshSeller(qc);
      toast.success("Business profile saved");
      onDone?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="sm:col-span-2">
        <label className="label">Business name</label>
        <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Main category</label>
        <select className="input" required value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="">Choose…</option>
          {cats?.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">District</label>
        <select className="input" required value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}>
          <option value="">Choose…</option>
          {cats?.districts.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Business address</label>
        <input className="input" required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Street, sector" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Short bio ({words}/100 words)</label>
        <textarea className="input" rows={3} required value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
        <p className="mt-1 text-xs text-stone-500">No phone numbers, emails or social handles — couples contact you through HUZA.</p>
      </div>
      <div>
        <label className="label">Opening hours (optional)</label>
        <input className="input" value={f.openHours} onChange={(e) => setF({ ...f, openHours: e.target.value })} placeholder="Mon–Sat 8:00–18:00" />
      </div>
      <div>
        <label className="label">Website (optional)</label>
        <input className="input" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" />
      </div>
      <div className="sm:col-span-2">
        <button className="btn-primary" disabled={save.isPending || words > 100}>{save.isPending ? <Spinner /> : submitLabel}</button>
      </div>
    </form>
  );
};

// ───── Step 3: payout method ─────
export const PayoutForm = ({ seller, onDone, submitLabel = "Save & continue" }: { seller: Seller | null; onDone?: () => void; submitLabel?: string }) => {
  const qc = useQueryClient();
  const [type, setType] = useState<"momo" | "bank">(seller?.paymentMethod === "bank" ? "bank" : "momo");
  const [momo, setMomo] = useState({ phone_number: seller?.momoPhoneNumber || "", name: seller?.momoName || seller?.name || "", network: seller?.momoNetwork || "MTN" });
  const [bank, setBank] = useState({ bank_code: seller?.bankCode || "", account_number: seller?.bankAccountNumber || "", account_name: seller?.bankAccountName || "" });
  const { data: banks } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => (await api.get("/auth/api/banks")).data.banks as { code: string; name: string }[],
    enabled: type === "bank",
  });
  const save = useMutation({
    mutationFn: async () =>
      api.post(
        "/auth/api/save-seller-payment",
        type === "momo" ? { type, ...momo } : { type, ...bank, bank_name: banks?.find((b) => b.code === bank.bank_code)?.name }
      ),
    onSuccess: async () => {
      await refreshSeller(qc);
      toast.success("Payout method saved");
      onDone?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <p className="muted">HUZA pays you every Thursday for services delivered and released by Wednesday: 85% of each booking after processing fees, minus any fines. HUZA covers the transfer fee.</p>
      <div className="grid grid-cols-2 gap-3">
        {(["momo", "bank"] as const).map((t) => (
          <button type="button" key={t} onClick={() => setType(t)} className={`rounded-xl border p-4 text-left ${type === t ? "border-brand-600 bg-brand-50" : "border-stone-200"}`}>
            <p className="font-semibold">{t === "momo" ? "Mobile Money" : "Bank account"}</p>
            <p className="text-xs text-stone-500">{t === "momo" ? "MTN MoMo or Airtel Money" : "Any Rwandan bank"}</p>
          </button>
        ))}
      </div>
      {type === "momo" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Network</label>
            <select className="input" value={momo.network} onChange={(e) => setMomo({ ...momo, network: e.target.value })}>
              <option value="MTN">MTN MoMo</option>
              <option value="AIRTEL">Airtel Money</option>
            </select>
          </div>
          <div>
            <label className="label">MoMo number</label>
            <input className="input" required value={momo.phone_number} onChange={(e) => setMomo({ ...momo, phone_number: e.target.value })} placeholder="078X XXX XXX" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Name registered on the MoMo account</label>
            <input className="input" required value={momo.name} onChange={(e) => setMomo({ ...momo, name: e.target.value })} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Bank</label>
            <select className="input" required value={bank.bank_code} onChange={(e) => setBank({ ...bank, bank_code: e.target.value })}>
              <option value="">Choose…</option>
              {banks?.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Account number</label>
            <input className="input" required value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div>
            <label className="label">Account name</label>
            <input className="input" required value={bank.account_name} onChange={(e) => setBank({ ...bank, account_name: e.target.value })} />
          </div>
        </div>
      )}
      <button className="btn-primary" disabled={save.isPending}>{save.isPending ? <Spinner /> : submitLabel}</button>
    </form>
  );
};

// ───── Step 4: verification (6-B) ─────
const FilePick = ({ label, value, onChange, done }: { label: string; value: string; onChange: (v: string) => void; done?: boolean }) => (
  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stone-300 p-4 hover:bg-stone-50">
    {value || done ? <FileCheck2 className="text-emerald-600" /> : <Upload className="text-stone-500" />}
    <span className="text-sm">
      <span className="font-medium">{label}</span>
      <span className="block text-xs text-stone-500">{value ? "Selected — will upload on submit" : done ? "Uploaded (choose a file to replace)" : "PNG, JPG or PDF, max 5 MB"}</span>
    </span>
    <input
      type="file"
      accept="image/*,application/pdf"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return toast.error("File must be under 5 MB");
        onChange(await fileToDataUrl(file));
      }}
    />
  </label>
);

export const VerificationForm = ({ seller, onDone }: { seller: Seller | null; onDone?: () => void }) => {
  const qc = useQueryClient();
  const [nid, setNid] = useState("");
  const [rdb, setRdb] = useState(seller?.rdbNumber || "");
  const [nidDoc, setNidDoc] = useState("");
  const [rdbDoc, setRdbDoc] = useState("");
  const isCompany = seller?.accountType === "company";
  const submit = useMutation({
    mutationFn: async () =>
      api.post("/auth/api/seller-verification", {
        nationalIdNumber: nid,
        nationalIdDoc: nidDoc || undefined,
        rdbNumber: isCompany ? rdb : undefined,
        rdbCertificateDoc: rdbDoc || undefined,
      }),
    onSuccess: async () => {
      await refreshSeller(qc);
      toast.success("Submitted! We'll review your documents within 1–2 working days.");
      onDone?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (seller?.verificationStatus === "pending") {
    return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your documents are being reviewed. You can prepare your listings meanwhile; they go live once you're verified.</p>;
  }
  if (seller?.verificationStatus === "approved") {
    return <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">✓ Your account is verified.</p>;
  }
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
      {seller?.verificationStatus === "rejected" && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">Previous submission was rejected: {seller.verificationNote}</p>
      )}
      <p className="muted">
        To protect couples, every provider is verified before listings go live. Documents are stored privately and only HUZA admins can see them.
      </p>
      <div>
        <label className="label">National ID number (16 digits)</label>
        <input className="input" required value={nid} onChange={(e) => setNid(e.target.value.replace(/\D/g, "").slice(0, 16))} />
      </div>
      <FilePick label="Photo or scan of your national ID" value={nidDoc} onChange={setNidDoc} done={seller?.nationalIdDoc?.uploaded} />
      {isCompany && (
        <>
          <div>
            <label className="label">RDB company code</label>
            <input className="input" required value={rdb} onChange={(e) => setRdb(e.target.value)} />
          </div>
          <FilePick label="RDB registration certificate" value={rdbDoc} onChange={setRdbDoc} done={seller?.rdbCertificateDoc?.uploaded} />
        </>
      )}
      <button className="btn-primary" disabled={submit.isPending || nid.length !== 16}>{submit.isPending ? <Spinner /> : "Submit for verification"}</button>
    </form>
  );
};
