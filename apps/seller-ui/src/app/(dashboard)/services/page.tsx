"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { rwf } from "@/lib/format";
import { Empty, PageLoader } from "@/components/ui";

const USER_UI = process.env.NEXT_PUBLIC_USER_UI_URL || "http://localhost:3000";
const STATUS: Record<string, string> = { published: "bg-emerald-100 text-emerald-800", draft: "bg-stone-200 text-stone-700", hidden: "bg-amber-100 text-amber-800" };

export default function MyServices() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-services"], queryFn: async () => (await api.get("/catalog/api/seller/services")).data.services as any[] });
  const act = useMutation({
    mutationFn: async ({ id, action, status }: { id: string; action: "status" | "delete" | "restore"; status?: string }) => {
      if (action === "status") return api.patch(`/catalog/api/seller/services/${id}/status`, { status });
      if (action === "delete") return api.delete(`/catalog/api/seller/services/${id}`);
      return api.post(`/catalog/api/seller/services/${id}/restore`);
    },
    onSuccess: (_r, v) => {
      toast.success(v.action === "delete" ? "Deleted — you can restore it within 24 hours" : "Updated");
      qc.invalidateQueries({ queryKey: ["my-services"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading) return <PageLoader />;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My services</h1>
        <Link href="/services/new" className="btn-primary"><Plus size={16} /> New listing</Link>
      </div>
      {!data?.length ? (
        <Empty title="No listings yet" text="Create your first listing with photos, what's included and pricing options." action={<Link href="/services/new" className="btn-primary">Create a listing</Link>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr><th className="p-3">Service</th><th className="p-3">Price</th><th className="p-3">Status</th><th className="p-3">Views</th><th className="p-3">Bookings</th><th className="p-3">Rating</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map((s) => (
                <tr key={s.id} className={s.isDeleted ? "opacity-60" : ""}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 overflow-hidden rounded bg-stone-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {s.images[0] && <img src={s.images[0].url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <span className="font-medium">{s.title}</span>
                    </div>
                  </td>
                  <td className="p-3">{rwf(s.basePrice)}</td>
                  <td className="p-3"><span className={`badge ${s.isDeleted ? "bg-red-100 text-red-800" : STATUS[s.status]}`}>{s.isDeleted ? "deleted" : s.status}</span></td>
                  <td className="p-3">{s.views}</td>
                  <td className="p-3">{s.bookingsCount}</td>
                  <td className="p-3">{s.reviewCount ? `${s.ratings.toFixed(1)} (${s.reviewCount})` : "—"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {s.isDeleted ? (
                        <button className="btn-ghost px-2" title="Restore" onClick={() => act.mutate({ id: s.id, action: "restore" })}><RotateCcw size={16} /></button>
                      ) : (
                        <>
                          {s.status === "published" && <a className="btn-ghost px-2" href={`${USER_UI}/services/${s.slug}`} target="_blank" rel="noreferrer" title="View"><Eye size={16} /></a>}
                          <Link className="btn-ghost px-2" href={`/services/${s.id}/edit`} title="Edit"><Pencil size={16} /></Link>
                          {s.status === "published" ? (
                            <button className="btn-ghost px-2" title="Hide" onClick={() => act.mutate({ id: s.id, action: "status", status: "hidden" })}><EyeOff size={16} /></button>
                          ) : (
                            <button className="btn-ghost px-2 text-emerald-700" title="Publish" onClick={() => act.mutate({ id: s.id, action: "status", status: "published" })}>Publish</button>
                          )}
                          <button className="btn-ghost px-2 text-red-600" title="Delete" onClick={() => confirm("Delete this listing? You can restore it within 24 hours.") && act.mutate({ id: s.id, action: "delete" })}><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
