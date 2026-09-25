"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { formatDateTime, rwf } from "@/lib/format";
import { PageLoader } from "@/components/ui";
import { Pill, STATUS_COLORS, Table, Td } from "@/components/Table";

function Payouts() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const [status, setStatus] = useState(params.get("status") || "");
  const { data, isLoading } = useQuery({ queryKey: ["admin-payouts", status], queryFn: async () => (await api.get(`/admin/api/payouts?status=${status}`)).data });
  const retry = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/api/payouts/${id}/retry`),
    onSuccess: () => { toast.success("Retried"); qc.invalidateQueries({ queryKey: ["admin-payouts"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const run = useMutation({
    mutationFn: async () => (await api.post("/admin/api/payouts/run")).data,
    onSuccess: (d) => { toast.success(`${d.payouts} payouts created`); qc.invalidateQueries({ queryKey: ["admin-payouts"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading || !data) return <PageLoader />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Payouts</h1>
        <button className="btn-outline" disabled={run.isPending} onClick={() => confirm("Run this Thursday's payouts now? (Only works on Thursdays)") && run.mutate()}>Run Thursday payouts now</button>
      </div>
      <div className="card p-5 text-sm">
        <p className="text-stone-500">Due on the next Thursday</p>
        <p className="text-2xl font-bold">{rwf(data.nextBatch.amount)}</p>
        <p className="text-stone-500">from {data.nextBatch.bookings} released booking(s). Runs automatically every Thursday at 09:00 Kigali time. Keep enough balance in Flutterwave to cover it.</p>
      </div>
      <div className="flex flex-wrap gap-2">{["", "failed", "processing", "successful", "settled"].map((s) => <button key={s} className={status === s ? "btn-dark" : "btn-outline"} onClick={() => setStatus(s)}>{s || "all"}</button>)}</div>
      <Table head={["Thursday", "Provider", "Gross", "Fines", "Sent", "Method", "Status", "Updated", ""]}>
        {data.payouts.map((p: any) => (
          <tr key={p.id}>
            <Td>{p.batchDate}</Td>
            <Td>{p.sellerName}</Td>
            <Td>{rwf(p.gross)}</Td>
            <Td>{rwf(p.penaltyDeducted)}</Td>
            <Td className="font-semibold">{rwf(p.amount)}</Td>
            <Td>{p.method}</Td>
            <Td><Pill value={p.status} map={STATUS_COLORS} />{p.failureReason && <span className="block text-xs text-red-600">{p.failureReason}</span>}</Td>
            <Td>{formatDateTime(p.updatedAt)}</Td>
            <Td>{p.status === "failed" && <button className="btn-outline py-1" disabled={retry.isPending} onClick={() => retry.mutate(p.id)}>Retry</button>}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export default function PayoutsPage() {
  return <Suspense fallback={null}><Payouts /></Suspense>;
}
