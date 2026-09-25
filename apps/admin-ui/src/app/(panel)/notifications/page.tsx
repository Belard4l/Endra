"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Empty, PageLoader } from "@/components/ui";

export default function AdminNotifications() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-notifications"], queryFn: async () => (await api.get("/booking/api/admin/notifications?limit=100")).data });
  const readAll = useMutation({ mutationFn: () => api.post("/booking/api/admin/notifications/read-all"), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }) });
  if (isLoading) return <PageLoader />;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Notifications</h1>{!!data?.unread && <button className="btn-outline" onClick={() => readAll.mutate()}>Mark all as read</button>}</div>
      {!data?.notifications.length ? <Empty title="No notifications" /> : (
        <div className="card divide-y divide-stone-100">
          {data.notifications.map((n: any) => (
            <div key={n.id} className={`p-4 text-sm ${n.isRead ? "" : "bg-brand-50/60"}`}>
              <div className="flex justify-between gap-3"><p className="font-semibold">{n.title}</p><span className="text-xs text-stone-400">{formatDateTime(n.createdAt)}</span></div>
              <p className="mt-1">{n.message}</p>
              {n.link && <Link href={n.link} className="text-brand-700 underline">Open</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
