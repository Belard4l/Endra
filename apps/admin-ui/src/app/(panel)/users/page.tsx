"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageLoader, Pagination } from "@/components/ui";
import { Pill, Table, Td, downloadCsv } from "@/components/Table";

export default function Users() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [admin, setAdmin] = useState({ name: "", email: "", password: "" });
  const { data, isLoading } = useQuery({ queryKey: ["admin-users", q, role, page], queryFn: async () => (await api.get(`/admin/api/users?q=${encodeURIComponent(q)}&role=${role}&page=${page}`)).data });
  const mut = useMutation({
    mutationFn: async ({ path, body }: { path: string; body: any }) => api.post(`/admin/api/${path}`, body),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Users & admins</h1>
        <button className="btn-outline" onClick={() => downloadCsv("/admin/api/users/export", "huza-users.csv", api)}>Export CSV</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input w-64" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input w-auto" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option><option value="user">Couples</option><option value="admin">Admins</option>
        </select>
      </div>
      {isLoading ? <PageLoader /> : (
        <>
          <Table head={["Name", "Email", "Phone", "Role", "Wedding", "Joined", ""]}>
            {data.users.map((u: any) => (
              <tr key={u.id}>
                <Td>{u.name}{u.isBanned && <span className="badge ml-2 bg-red-100 text-red-800">banned</span>}</Td>
                <Td>{u.email}</Td>
                <Td>{u.phone || "—"}</Td>
                <Td><Pill value={u.role} /></Td>
                <Td>{u.weddingDate ? `${u.weddingDate} · ${u.weddingDistrict || ""}` : "—"}</Td>
                <Td>{formatDate(u.createdAt)}</Td>
                <Td>
                  <div className="flex gap-1">
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => mut.mutate({ path: `users/${u.id}/ban`, body: { banned: !u.isBanned } })}>{u.isBanned ? "Unban" : "Ban"}</button>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => mut.mutate({ path: `users/${u.id}/role`, body: { role: u.role === "admin" ? "user" : "admin" } })}>{u.role === "admin" ? "Remove admin" : "Make admin"}</button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
      <form className="card grid gap-3 p-5 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); mut.mutate({ path: "admins", body: admin }); setAdmin({ name: "", email: "", password: "" }); }}>
        <h2 className="font-semibold sm:col-span-4">Add an admin</h2>
        <input className="input" placeholder="Name" value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} />
        <input className="input" type="email" placeholder="Email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
        <input className="input" type="password" placeholder="Password (10+ characters)" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} />
        <button className="btn-primary">Create admin</button>
      </form>
    </div>
  );
}
