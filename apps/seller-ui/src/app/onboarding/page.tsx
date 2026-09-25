"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSeller, { nextOnboardingStep } from "@/hooks/useSeller";
import Steps from "@/components/Steps";
import { BusinessForm, PayoutForm, VerificationForm } from "@/components/forms";
import { PageLoader } from "@/components/ui";

export default function Onboarding() {
  const { seller, isLoading } = useSeller();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!seller) return router.replace("/login");
    if (step === null) setStep(nextOnboardingStep(seller) ?? 5);
  }, [isLoading, seller]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !seller || step === null) return <PageLoader />;

  return (
    <div className="min-h-screen bg-sand px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="mb-6 text-center font-Poppins text-2xl font-extrabold text-brand-700">Set up your HUZA business</p>
        <div className="card p-8">
          <Steps active={Math.min(step, 4)} />
          {step === 2 && (
            <>
              <h2 className="mb-4 text-xl font-semibold">Your business profile</h2>
              <BusinessForm seller={seller} onDone={() => setStep(3)} />
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="mb-4 text-xl font-semibold">How should we pay you?</h2>
              <PayoutForm seller={seller} onDone={() => setStep(4)} />
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="mb-4 text-xl font-semibold">Verify your identity</h2>
              <VerificationForm seller={seller} onDone={() => setStep(5)} />
              {seller.verificationStatus === "pending" && (
                <button className="btn-primary mt-4" onClick={() => setStep(5)}>Continue</button>
              )}
            </>
          )}
          {step >= 5 && (
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold">You're all set 🎉</h2>
              <p className="muted">
                {seller.verificationStatus === "approved"
                  ? "Your account is verified. Create your first listing to start receiving bookings."
                  : "We're reviewing your documents. Create your listings now — they go live as soon as you're verified."}
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Link href="/services/new" className="btn-primary">Create a listing</Link>
                <Link href="/dashboard" className="btn-outline">Go to dashboard</Link>
              </div>
            </div>
          )}
        </div>
        {step < 5 && step > 2 && (
          <button className="mx-auto mt-4 block text-sm text-stone-500 underline" onClick={() => setStep(step - 1)}>Back</button>
        )}
      </div>
    </div>
  );
}
