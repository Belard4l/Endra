"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import OtpInput from "@/components/OtpInput";
import Steps from "@/components/Steps";

type Form = { name: string; email: string; phone_number: string; accountType: "individual" | "company"; password: string };

export default function SellerSignup() {
  const router = useRouter();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ defaultValues: { accountType: "individual" } });

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const send = useMutation({
    mutationFn: async (d: Form) => (await api.post("/auth/api/seller-registration", d)).data,
    onSuccess: (_r, d) => { setForm(d); setTimer(60); toast.success("Code sent to your email"); },
  });
  const verify = useMutation({
    mutationFn: async () => (await api.post("/auth/api/verify-seller", { ...form, otp: otp.join("") })).data,
    onSuccess: (d) => { qc.setQueryData(["seller"], d.seller); router.push("/onboarding"); },
  });

  return (
    <div className="min-h-screen bg-sand px-4 py-10">
      <div className="mx-auto max-w-xl">
        <p className="mb-6 text-center font-Poppins text-2xl font-extrabold text-brand-700">HUZA for providers</p>
        <div className="card p-8">
          <Steps active={1} />
          {!form ? (
            <form className="space-y-4" onSubmit={handleSubmit((d) => send.mutate(d))}>
              <div>
                <label className="label">Your full name</label>
                <input className="input" {...register("name", { required: "Required" })} />
                {errors.name && <p className="error-text">{errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" {...register("email", { required: "Required" })} />
              </div>
              <div>
                <label className="label">Phone (Rwanda)</label>
                <input className="input" placeholder="07XX XXX XXX" {...register("phone_number", { required: "Required", pattern: { value: /^(\+?250|0)?7[2389]\d{7}$/, message: "Enter a valid Rwandan number" } })} />
                {errors.phone_number && <p className="error-text">{errors.phone_number.message}</p>}
              </div>
              <div>
                <label className="label">Are you registering as…</label>
                <select className="input" {...register("accountType")}>
                  <option value="individual">An individual (national ID)</option>
                  <option value="company">A company (national ID + RDB certificate)</option>
                </select>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={show ? "text" : "password"} className="input pr-10" {...register("password", { required: "Required", minLength: { value: 8, message: "At least 8 characters" } })} />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">{show ? <Eye size={18} /> : <EyeOff size={18} />}</button>
                </div>
                {errors.password && <p className="error-text">{errors.password.message}</p>}
              </div>
              <button className="btn-primary w-full py-3" disabled={send.isPending}>{send.isPending ? "Sending code…" : "Continue"}</button>
              {send.isError && <p className="error-text text-center">{errorMessage(send.error)}</p>}
              <p className="muted text-center">Already registered? <Link className="font-semibold text-brand-700" href="/login">Log in</Link></p>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm">Enter the 6-digit code sent to <strong>{form.email}</strong></p>
              <OtpInput value={otp} onChange={setOtp} />
              <button className="btn-primary w-full py-3" disabled={verify.isPending || otp.join("").length < 6} onClick={() => verify.mutate()}>
                {verify.isPending ? "Verifying…" : "Verify email"}
              </button>
              {verify.isError && <p className="error-text text-center">{errorMessage(verify.error)}</p>}
              <p className="text-center text-sm">{timer > 0 ? `Resend in ${timer}s` : <button className="text-brand-700" onClick={() => send.mutate(form)}>Resend code</button>}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
