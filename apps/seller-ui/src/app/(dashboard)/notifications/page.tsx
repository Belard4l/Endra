"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Empty, PageLoader } from "@/components/ui";

export default function SellerNotifications() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["seller-notifications"], queryFn: async () => (await api.get("/booking/api/seller/notifications?limit=50")).data });
  const readAll = useMutation({ mutationFn: () => api.post("/booking/api/seller/notifications/read-all"), onSuccess: () => { qc.invalidateQueries({ queryKey: ["seller-notifications"] }); qc.invalidateQueries({ queryKey: ["unread"] }); } });
  const read = (id: string) => api.patch(`/booking/api/seller/notifications/${id}/read`).then(() => qc.invalidateQueries({ queryKey: ["unread"] }));
  if (isLoading) return <PageLoader />;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {!!data?.unread && <button className="btn-outline" onClick={() => readAll.mutate()}>Mark all as read</button>}
      </div>
      {!data?.notifications.length ? <Empty title="No notifications yet" /> : (
        <div className="card divide-y divide-stone-100">
          {data.notifications.map((n: any) => {
            const body = (
              <div className={`p-4 ${n.isRead ? "" : "bg-brand-50/60"}`}>
                <div className="flex justify-between gap-3"><p className="font-semibold">{n.title}</p><span className="shrink-0 text-xs text-stone-400">{formatDateTime(n.createdAt)}</span></div>
                <p className="mt-1 whitespace-pre-line text-sm text-stone-700">{n.message}</p>
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link} onClick={() => read(n.id)} className="block hover:bg-stone-50">{body}</Link> : <div key={n.id} onClick={() => read(n.id)}>{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}
