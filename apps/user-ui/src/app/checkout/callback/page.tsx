"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useStore } from "@/store";
import { Spinner } from "@/components/ui";

function Callback() {
  const params = useSearchParams();
  const clearBasket = useStore((s) => s.clearBasket);
  const qc = useQueryClient();
  const [state, setState] = useState<"checking" | "successful" | "failed" | "pending">("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    const txRef = params.get("tx_ref") || (typeof window !== "undefined" ? sessionStorage.getItem("huza-last-tx") : "") || "";
    const transactionId = params.get("transaction_id");
    const status = params.get("status");
    if (!txRef) {
      setState("failed");
      setError("Missing payment reference.");
      return;
    }
    if (status === "cancelled") {
      setState("failed");
      setError("You cancelled the payment. Your dates are held for a few more minutes — you can try again from your basket.");
      return;
    }
    let tries = 0;
    const check = async () => {
      try {
        const q = new URLSearchParams({ tx_ref: txRef });
        if (transactionId) q.set("transaction_id", transactionId);
        const { data } = await api.get(`/booking/api/payments/verify?${q}`);
        if (data.status === "successful") {
          setState("successful");
          clearBasket();
          sessionStorage.removeItem("huza-last-tx");
          qc.invalidateQueries({ queryKey: ["my-bookings"] });
          return;
        }
        if (data.status === "failed") return setState("failed");
        if (++tries < 10) setTimeout(check, 3000);
        else setState("pending");
      } catch (e) {
        setError(errorMessage(e));
        setState("failed");
      }
    };
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="container-x flex min-h-[60vh] items-center justify-center py-12">
      <div className="card max-w-md p-8 text-center">
        {state === "checking" && (
          <>
            <Spinner className="mx-auto h-8 w-8 text-brand-700" />
            <p className="mt-4 font-semibold">Confirming your payment…</p>
            <p className="muted mt-1">If you paid by MoMo, approve the prompt on your phone.</p>
          </>
        )}
        {state === "successful" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-semibold">You're booked! 🎉</h1>
            <p className="muted mt-2">We've sent a confirmation by email and SMS. HUZA holds your payment until each service is delivered.</p>
            <Link href="/bookings" className="btn-primary mt-6">
              See my bookings
            </Link>
          </>
        )}
        {state === "pending" && (
          <>
            <Clock className="mx-auto h-12 w-12 text-amber-500" />
            <h1 className="mt-4 text-xl font-semibold">Payment still processing</h1>
            <p className="muted mt-2">We'll confirm your booking as soon as the payment clears — check My bookings in a few minutes.</p>
            <Link href="/bookings" className="btn-primary mt-6">
              My bookings
            </Link>
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-xl font-semibold">Payment not completed</h1>
            <p className="muted mt-2">{error || "The payment didn't go through. Nothing was charged."}</p>
            <Link href="/basket" className="btn-primary mt-6">
              Back to basket
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
