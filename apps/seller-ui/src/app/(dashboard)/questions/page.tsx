"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Empty, PageLoader } from "@/components/ui";

export default function Questions() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"unanswered" | "all">("unanswered");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({ queryKey: ["seller-questions", filter], queryFn: async () => (await api.get(`/catalog/api/seller/questions?status=${filter}`)).data.questions as any[] });
  const answer = useMutation({
    mutationFn: async (id: string) => api.post(`/catalog/api/seller/questions/${id}/answer`, { answer: answers[id] }),
    onSuccess: () => { toast.success("Answer posted publicly"); qc.invalidateQueries({ queryKey: ["seller-questions"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Questions from couples</h1>
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Answers are public on your listing. Phone numbers, emails, links and social handles are blocked — each attempt counts, and 3 attempts add a strike. Couples can reach you directly on the wedding day.</p>
      <div className="flex gap-2">
        {(["unanswered", "all"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={filter === f ? "btn-dark" : "btn-outline"}>{f === "unanswered" ? "Unanswered" : "All"}</button>)}
      </div>
      {isLoading ? <PageLoader /> : !data?.length ? <Empty title="No questions here" /> : (
        <div className="space-y-3">
          {data.map((q) => (
            <div key={q.id} className="card p-5">
              <p className="text-xs text-stone-500">{q.service?.title} · {formatDateTime(q.createdAt)}</p>
              <p className="mt-1 font-medium">{q.userName}: {q.question}</p>
              {q.answer ? (
                <p className="mt-2 text-sm text-stone-700"><span className="font-semibold text-brand-700">Your answer:</span> {q.answer}</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input className="input flex-1" placeholder="Write a public answer…" value={answers[q.id] || ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  <button className="btn-primary" disabled={answer.isPending || !(answers[q.id] || "").trim()} onClick={() => answer.mutate(q.id)}>Answer</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
