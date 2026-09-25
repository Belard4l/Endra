"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api, { errorMessage } from "@/lib/api";

export default function AdminLogin() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: async () => (await api.post("/auth/api/login-admin", { email, password })).data,
    onSuccess: (d) => {
      qc.setQueryData(["admin"], d.admin);
      router.push("/dashboard");
    },
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-900 p-6">
      <form className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8" onSubmit={(e) => { e.preventDefault(); login.mutate(); }}>
        <p className="text-center font-Poppins text-2xl font-extrabold text-brand-700">HUZA Admin</p>
        <input type="email" className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-primary w-full" disabled={login.isPending}>Log in</button>
        {login.isError && <p className="error-text text-center">{errorMessage(login.error)}</p>}
      </form>
    </div>
  );
}
