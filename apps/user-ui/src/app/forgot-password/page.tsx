"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import OtpInput from "@/components/OtpInput";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");

  const request = useMutation({
    mutationFn: async () => api.post("/auth/api/forgot-password-user", { email }),
    onSuccess: () => { setStep("otp"); toast.success("Code sent to your email"); },
  });
  const verify = useMutation({
    mutationFn: async () => api.post("/auth/api/verify-forgot-password-user", { email, otp: otp.join("") }),
    onSuccess: () => setStep("reset"),
  });
  const reset = useMutation({
    mutationFn: async () => api.post("/auth/api/reset-password-user", { email, newPassword: password }),
    onSuccess: () => { toast.success("Password updated — please sign in"); router.push("/login"); },
  });
  const err = request.error || verify.error || reset.error;

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <div className="card w-full max-w-md space-y-4 p-8">
        <h1 className="text-center text-2xl font-semibold">Reset your password</h1>
        {step === "email" && (
          <>
            <input type="email" className="input" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn-primary w-full" disabled={!email || request.isPending} onClick={() => request.mutate()}>Send code</button>
          </>
        )}
        {step === "otp" && (
          <>
            <OtpInput value={otp} onChange={setOtp} />
            <button className="btn-primary w-full" disabled={otp.join("").length < 6 || verify.isPending} onClick={() => verify.mutate()}>Verify code</button>
          </>
        )}
        {step === "reset" && (
          <>
            <input type="password" className="input" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn-primary w-full" disabled={password.length < 8 || reset.isPending} onClick={() => reset.mutate()}>Save new password</button>
          </>
        )}
        {err && <p className="error-text text-center">{errorMessage(err)}</p>}
        <p className="text-center text-sm"><Link href="/login" className="text-brand-700">Back to sign in</Link></p>
      </div>
    </div>
  );
}
