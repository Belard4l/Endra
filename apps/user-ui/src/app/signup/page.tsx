"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import OtpInput from "@/components/OtpInput";

type Form = { name: string; email: string; password: string };

export default function SignupPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<"form" | "otp">("form");
  const [data, setData] = useState<Form | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>();

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const send = useMutation({
    mutationFn: async (d: Form) => (await api.post("/auth/api/user-registration", d)).data,
    onSuccess: (_r, d) => {
      setData(d);
      setStep("otp");
      setTimer(60);
      toast.success("We sent a 6-digit code to your email");
    },
  });
  const verify = useMutation({
    mutationFn: async () => (await api.post("/auth/api/verify-user", { ...data, otp: otp.join("") })).data,
    onSuccess: () => {
      toast.success("Account created — please sign in");
      router.push("/login");
    },
  });

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-center text-2xl font-semibold">Create your HUZA account</h1>
        <p className="muted mt-1 text-center">
          Already have one? <Link href="/login" className="font-semibold text-brand-700">Sign in</Link>
        </p>
        {step === "form" ? (
          <form onSubmit={handleSubmit((d) => send.mutate(d))} className="mt-6 space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" {...register("name", { required: "Name is required" })} />
              {errors.name && <p className="error-text">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" {...register("email", { required: "Email is required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" } })} />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={show ? "text" : "password"} className="input pr-10" {...register("password", { required: "Password is required", minLength: { value: 8, message: "At least 8 characters" } })} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                  {show ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>
            <button className="btn-primary w-full py-3" disabled={send.isPending}>{send.isPending ? "Sending code…" : "Sign up"}</button>
            {send.isError && <p className="error-text text-center">{errorMessage(send.error)}</p>}
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-center text-sm">Enter the code sent to <strong>{data?.email}</strong></p>
            <OtpInput value={otp} onChange={setOtp} />
            <button className="btn-primary w-full py-3" disabled={verify.isPending || otp.join("").length < 6} onClick={() => verify.mutate()}>
              {verify.isPending ? "Verifying…" : "Verify & create account"}
            </button>
            {verify.isError && <p className="error-text text-center">{errorMessage(verify.error)}</p>}
            <p className="text-center text-sm">
              {timer > 0 ? `Resend code in ${timer}s` : <button className="text-brand-700" onClick={() => data && send.mutate(data)}>Resend code</button>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
