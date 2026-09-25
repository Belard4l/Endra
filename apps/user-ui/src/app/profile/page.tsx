"use client";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import useUser from "@/hooks/useUser";
import { useCategories } from "@/hooks/useCategories";
import { useI18n } from "@/lib/i18n";
import { kigaliToday } from "@/lib/format";
import RequireUser from "@/components/RequireUser";

function Profile() {
  const { user, setUser } = useUser();
  const { setLang } = useI18n();
  const { data: cats } = useCategories();
  const [form, setForm] = useState({ name: "", phone: "", language: "en", weddingDate: "", weddingDistrict: "", budget: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  useEffect(() => {
    if (user)
      setForm({
        name: user.name,
        phone: user.phone || "",
        language: user.language || "en",
        weddingDate: user.weddingDate || "",
        weddingDistrict: user.weddingDistrict || "",
        budget: user.budget ? String(user.budget) : "",
      });
  }, [user]);

  const save = useMutation({
    mutationFn: async () => (await api.put("/auth/api/user-profile", { ...form, budget: form.budget ? Number(form.budget) : null })).data,
    onSuccess: (d) => {
      setUser(d.user);
      setLang(d.user.language === "rw" ? "rw" : "en");
      toast.success("Saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const changePw = useMutation({
    mutationFn: async () => api.post("/auth/api/change-password-user", pw),
    onSuccess: () => {
      setPw({ currentPassword: "", newPassword: "" });
      toast.success("Password changed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="container-x max-w-3xl space-y-6 py-8">
      <h1 className="text-3xl font-semibold">My account</h1>
      <form className="card grid gap-4 p-6 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <h2 className="text-lg font-semibold sm:col-span-2">Your wedding</h2>
        <p className="muted -mt-3 sm:col-span-2">Used to suggest providers who are free on your day, near you and within budget.</p>
        <div>
          <label className="label">Wedding date</label>
          <input type="date" min={kigaliToday()} className="input" value={form.weddingDate} onChange={(e) => setForm({ ...form, weddingDate: e.target.value })} />
        </div>
        <div>
          <label className="label">District</label>
          <select className="input" value={form.weddingDistrict} onChange={(e) => setForm({ ...form, weddingDistrict: e.target.value })}>
            <option value="">—</option>
            {cats?.districts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Budget per service (RWF)</label>
          <input type="number" min={0} className="input" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
        </div>
        <div />
        <h2 className="mt-2 text-lg font-semibold sm:col-span-2">Account</h2>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone (for SMS alerts)</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07XX XXX XXX" />
        </div>
        <div>
          <label className="label">Language / Ururimi</label>
          <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            <option value="en">English</option>
            <option value="rw">Kinyarwanda</option>
          </select>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input bg-stone-50" value={user?.email || ""} disabled />
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={save.isPending}>Save changes</button>
        </div>
      </form>

      <form className="card grid gap-4 p-6 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}>
        <h2 className="text-lg font-semibold sm:col-span-2">Change password</h2>
        <input type="password" className="input" placeholder="Current password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        <input type="password" className="input" placeholder="New password (8+ characters)" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        <div className="sm:col-span-2">
          <button className="btn-outline" disabled={changePw.isPending || pw.newPassword.length < 8}>Update password</button>
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireUser>
      <Profile />
    </RequireUser>
  );
}
