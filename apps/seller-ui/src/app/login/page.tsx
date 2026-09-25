"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { nextOnboardingStep } from "@/hooks/useSeller";

type Form = { email: string; password: string };

export default function SellerLogin() {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm<Form>();
  const login = useMutation({
    mutationFn: async (d: Form) => (await api.post("/auth/api/login-seller", d)).data,
    onSuccess: async () => {
      const { data } = await api.get("/auth/api/logged-in-seller");
      qc.setQueryData(["seller"], data.seller);
      router.push(nextOnboardingStep(data.seller) ? "/onboarding" : "/dashboard");
    },
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-6">
      <div className="card w-full max-w-md p-8">
        <p className="text-center font-Poppins text-2xl font-extrabold text-brand-700">HUZA</p>
        <h1 className="mt-1 text-center text-xl font-semibold">Provider login</h1>
        <form onSubmit={handleSubmit((d) => login.mutate(d))} className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" {...register("email", { required: true })} />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input type={show ? "text" : "password"} className="input pr-10" {...register("password", { required: true })} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {show ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>
          <div className="text-right"><Link href="/forgot-password" className="text-sm text-brand-700">Forgot password?</Link></div>
          <button className="btn-primary w-full py-3" disabled={login.isPending}>{login.isPending ? "Logging in…" : "Log in"}</button>
          {login.isError && <p className="error-text text-center">{errorMessage(login.error)}</p>}
        </form>
        <p className="muted mt-6 text-center">New provider? <Link href="/signup" className="font-semibold text-brand-700">Create an account</Link></p>
      </div>
    </div>
  );
}
