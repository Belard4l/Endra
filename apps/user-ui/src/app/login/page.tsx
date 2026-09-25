"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import api, { errorMessage } from "@/lib/api";

type Form = { email: string; password: string };

function Login() {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>();
  const login = useMutation({
    mutationFn: async (data: Form) => (await api.post("/auth/api/login-user", data)).data,
    onSuccess: (data) => {
      qc.setQueryData(["user"], data.user);
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/");
    },
  });
  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-center text-2xl font-semibold">Welcome back</h1>
        <p className="muted mt-1 text-center">
          New to HUZA? <Link href="/signup" className="font-semibold text-brand-700">Create an account</Link>
        </p>
        <form onSubmit={handleSubmit((d) => login.mutate(d))} className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" {...register("email", { required: "Email is required" })} />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input type={show ? "text" : "password"} className="input pr-10" {...register("password", { required: "Password is required" })} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {show ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {errors.password && <p className="error-text">{errors.password.message}</p>}
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-brand-700">Forgot password?</Link>
          </div>
          <button className="btn-primary w-full py-3" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</button>
          {login.isError && <p className="error-text text-center">{errorMessage(login.error)}</p>}
        </form>
        <p className="mt-6 text-center text-xs text-stone-500">
          Are you a wedding service provider? <a href={process.env.NEXT_PUBLIC_SELLER_UI_URL || "http://localhost:3001"} className="underline">Provider login</a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
