"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Pagination, PageLoader } from "@/components/ui";
import { Pill, STATUS_COLORS, Table, Td, downloadCsv } from "@/components/Table";

function Providers() {
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [verification, setVerification] = useState(params.get("verification") || "");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const banRecommended = params.get("banRecommended") === "true";
  const { data, isLoading } = useQuery({
    queryKey: ["admin-providers", q, verification, status, page, banRecommended],
    queryFn: async () => (await api.get(`/admin/api/providers?q=${encodeURIComponent(q)}&verification=${verification}&status=${status}&page=${page}${banRecommended ? "&banRecommended=true" : ""}`)).data,
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Providers</h1>
        <button className="btn-outline" onClick={() => downloadCsv("/admin/api/providers/export", "huza-providers.csv", api)}>Export CSV</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input w-64" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input w-auto" value={verification} onChange={(e) => { setVerification(e.target.value); setPage(1); }}>
          <option value="">Any verification</option>
          {["pending", "approved", "rejected", "unsubmitted"].map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option>
          {["active", "restricted", "suspended", "banned"].map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>
      {isLoading ? <PageLoader /> : (
        <>
          <Table head={["Provider", "Business", "Verification", "Status", "Strikes", "Weddings", "Joined"]}>
            {data.providers.map((p: any) => (
              <tr key={p.id} className="hover:bg-stone-50">
                <Td><Link href={`/providers/${p.id}`} className="font-medium text-brand-700">{p.name}</Link><span className="block text-xs text-stone-500">{p.email}</span></Td>
                <Td>{p.shop?.name || "—"}<span className="block text-xs text-stone-500">{p.shop?.category} · {p.shop?.district}</span></Td>
                <Td><Pill value={p.verificationStatus} map={STATUS_COLORS} /></Td>
                <Td><Pill value={p.status} map={STATUS_COLORS} />{p.banRecommended && <span className="badge ml-1 bg-red-600 text-white">ban?</span>}</Td>
                <Td>{p.activeStrikes}</Td>
                <Td>{p.completedCount}</Td>
                <Td>{formatDate(p.createdAt)}</Td>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function ProvidersPage() {
  return <Suspense fallback={null}><Providers /></Suspense>;
}
