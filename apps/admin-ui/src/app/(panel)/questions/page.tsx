"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Empty, PageLoader } from "@/components/ui";

export default function QuestionsModeration() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [hidden, setHidden] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["admin-questions", q, hidden], queryFn: async () => (await api.get(`/admin/api/questions?q=${encodeURIComponent(q)}${hidden ? "&hidden=true" : ""}`)).data.questions as any[] });
  const toggle = useMutation({ mutationFn: async ({ id, hide }: { id: string; hide: boolean }) => api.patch(`/admin/api/questions/${id}`, { hidden: hide }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-questions"] }) });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Q&A moderation</h1>
      <p className="muted">Contact details are blocked automatically. Hide anything else that breaks the rules (offensive content, disguised contact info).</p>
      <div className="flex gap-2">
        <input className="input w-72" placeholder="Search questions and answers" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hidden only</label>
      </div>
      {isLoading ? <PageLoader /> : !data?.length ? <Empty title="Nothing found" /> : (
        <div className="card divide-y divide-stone-100">
          {data.map((x) => (
            <div key={x.id} className="flex items-start justify-between gap-4 p-4 text-sm">
              <div>
                <p><span className="font-medium">{x.userName}:</span> {x.question}</p>
                {x.answer && <p className="mt-1 text-stone-600">Answer: {x.answer}</p>}
                <p className="mt-1 text-xs text-stone-400">{formatDateTime(x.createdAt)}</p>
              </div>
              <button className={x.isHidden ? "btn-outline py-1" : "btn-ghost py-1 text-red-600"} onClick={() => toggle.mutate({ id: x.id, hide: !x.isHidden })}>{x.isHidden ? "Unhide" : "Hide"}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
