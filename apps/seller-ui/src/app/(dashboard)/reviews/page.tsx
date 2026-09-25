"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Empty, PageLoader, Stars } from "@/components/ui";

export default function Reviews() {
  const { data, isLoading } = useQuery({ queryKey: ["seller-reviews"], queryFn: async () => (await api.get("/catalog/api/seller/reviews")).data.reviews as any[] });
  if (isLoading) return <PageLoader />;
  const avg = data?.length ? data.reduce((s, r) => s + r.rating, 0) / data.length : 0;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reviews</h1>
      <div className="card flex items-center gap-4 p-5"><Stars value={avg} count={data?.length} size={20} /><span className="muted">Only couples who booked and received your service can review it.</span></div>
      {!data?.length ? <Empty title="No reviews yet" /> : (
        <div className="card divide-y divide-stone-100">
          {data.map((r) => (
            <div key={r.id} className="p-5">
              <div className="flex justify-between"><span className="font-medium">{r.userName}</span><Stars value={r.rating} /></div>
              {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              <p className="mt-1 text-xs text-stone-400">{formatDate(r.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
