"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { fileToDataUrl } from "@/lib/format";
import useSeller from "@/hooks/useSeller";
import { BusinessForm, PayoutForm } from "@/components/forms";

export default function Settings() {
  const { seller } = useSeller();
  const qc = useQueryClient();
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [phone, setPhone] = useState(seller?.phone_number || "");
  const upload = useMutation({
    mutationFn: async (body: any) => api.put("/auth/api/seller-profile", body),
    onSuccess: async () => {
      const { data } = await api.get("/auth/api/logged-in-seller");
      qc.setQueryData(["seller"], data.seller);
      toast.success("Saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const changePw = useMutation({
    mutationFn: async () => api.post("/auth/api/change-password-seller", pw),
    onSuccess: () => { setPw({ currentPassword: "", newPassword: "" }); toast.success("Password changed"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const pick = (field: "avatar" | "coverBanner") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Max 5 MB");
    upload.mutate({ [field]: await fileToDataUrl(f) });
  };
  const shop = seller?.shop;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card overflow-hidden">
        <div className="relative h-40 bg-gradient-to-r from-brand-800 to-brand-500">
          {shop?.coverBanner?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.coverBanner.url} alt="" className="h-full w-full object-cover" />
          )}
          <label className="btn-outline absolute bottom-3 right-3 cursor-pointer py-1 text-xs">Change cover<input type="file" accept="image/*" className="hidden" onChange={pick("coverBanner")} /></label>
        </div>
        <div className="flex items-center gap-4 p-5">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-brand-100">
            {shop?.avatar?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.avatar.url} alt="" className="h-full w-full object-cover" />
            ) : <span className="flex h-full items-center justify-center text-xl font-bold text-brand-700">{shop?.name?.charAt(0)}</span>}
          </div>
          <label className="btn-outline cursor-pointer py-1.5">Change logo / photo<input type="file" accept="image/*" className="hidden" onChange={pick("avatar")} /></label>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">Business profile</h2>
        <BusinessForm seller={seller} submitLabel="Save profile" />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">Payout method</h2>
        <PayoutForm seller={seller} submitLabel="Save payout method" />
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Contact phone (for SMS alerts)</h2>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div><button className="btn-outline" onClick={() => upload.mutate({ phone_number: phone })}>Save phone</button></div>
      </section>

      <form className="card grid gap-4 p-6 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}>
        <h2 className="text-lg font-semibold sm:col-span-2">Change password</h2>
        <input type="password" className="input" placeholder="Current password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        <input type="password" className="input" placeholder="New password (8+)" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        <div className="sm:col-span-2"><button className="btn-outline" disabled={pw.newPassword.length < 8}>Update password</button></div>
      </form>
    </div>
  );
}
