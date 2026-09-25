"use client";
/**
 * Development-only payment page, used while FLUTTERWAVE_SECRET_KEY is not set.
 * It lets you simulate a successful or failed MoMo/card payment.
 */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import api, { errorMessage } from "@/lib/api";
import { rwf } from "@/lib/format";

function Mock() {
  const params = useSearchParams();
  const router = useRouter();
  const txRef = params.get("tx_ref") || "";
  const amount = Number(params.get("amount") || 0);
  const [busy, setBusy] = useState(false);

  const pay = async (outcome: "success" | "fail") => {
    setBusy(true);
    try {
      await api.post("/booking/api/payments/mock-complete", { txRef, outcome });
      router.push(`/checkout/callback?tx_ref=${encodeURIComponent(txRef)}&status=${outcome === "success" ? "successful" : "failed"}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="container-x flex min-h-[60vh] items-center justify-center py-12">
      <div className="card max-w-md space-y-4 p-8 text-center">
        <span className="badge bg-amber-100 text-amber-800">Test mode — no real money</span>
        <h1 className="text-2xl font-semibold">Pay {rwf(amount)}</h1>
        <p className="muted">Flutterwave keys aren't configured yet, so this page simulates the payment. Reference: {txRef}</p>
        <button className="btn-primary w-full" disabled={busy} onClick={() => pay("success")}>
          Simulate successful MoMo payment
        </button>
        <button className="btn-outline w-full" disabled={busy} onClick={() => pay("fail")}>
          Simulate failed payment
        </button>
      </div>
    </div>
  );
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={null}>
      <Mock />
    </Suspense>
  );
}
