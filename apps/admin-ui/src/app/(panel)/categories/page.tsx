"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { PageLoader } from "@/components/ui";
import { Table, Td } from "@/components/Table";

export default function Categories() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", nameRw: "", icon: "", order: 0 });
  const [edits, setEdits] = useState<Record<string, any>>({});
  const { data, isLoading } = useQuery({ queryKey: ["admin-categories"], queryFn: async () => (await api.get("/admin/api/categories")).data.categories as any[] });
  const save = useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: any }) => (id ? api.put(`/admin/api/categories/${id}`, body) : api.post("/admin/api/categories", body)),
    onSuccess: () => { toast.success("Saved"); setForm({ name: "", nameRw: "", icon: "", order: 0 }); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/api/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading) return <PageLoader />;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Categories</h1>
      {!data?.length && <p className="muted">The default wedding categories are created automatically the first time the site loads its category list.</p>}
      <Table head={["Icon", "Name (EN)", "Name (RW)", "Slug", "Order", ""]}>
        {data?.map((c) => {
          const e = edits[c.id] || c;
          const set = (k: string, v: any) => setEdits({ ...edits, [c.id]: { ...e, [k]: v } });
          return (
            <tr key={c.id}>
              <Td><input className="input w-16" value={e.icon || ""} onChange={(ev) => set("icon", ev.target.value)} /></Td>
              <Td><input className="input" value={e.name} onChange={(ev) => set("name", ev.target.value)} /></Td>
              <Td><input className="input" value={e.nameRw || ""} onChange={(ev) => set("nameRw", ev.target.value)} /></Td>
              <Td className="text-stone-500">{c.slug}</Td>
              <Td><input type="number" className="input w-20" value={e.order} onChange={(ev) => set("order", Number(ev.target.value))} /></Td>
              <Td>
                <div className="flex gap-1">
                  {edits[c.id] && <button className="btn-primary py-1" onClick={() => save.mutate({ id: c.id, body: e })}>Save</button>}
                  <button className="btn-ghost px-2 text-red-600" onClick={() => confirm(`Delete ${c.name}?`) && del.mutate(c.id)}><Trash2 size={16} /></button>
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>
      <form className="card grid gap-3 p-5 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); save.mutate({ body: form }); }}>
        <h2 className="font-semibold sm:col-span-5">Add a category</h2>
        <input className="input" placeholder="Icon (emoji)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
        <input className="input" placeholder="Name (English)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Name (Kinyarwanda)" value={form.nameRw} onChange={(e) => setForm({ ...form, nameRw: e.target.value })} />
        <input type="number" className="input" placeholder="Order" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
        <button className="btn-primary" disabled={!form.name}>Add</button>
      </form>
    </div>
  );
}
