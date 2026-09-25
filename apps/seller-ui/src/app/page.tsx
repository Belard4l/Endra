"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSeller, { nextOnboardingStep } from "@/hooks/useSeller";
import { PageLoader } from "@/components/ui";

export default function SellerHome() {
  const { seller, isLoading } = useSeller();
  const router = useRouter();
  useEffect(() => {
    if (seller) router.replace(nextOnboardingStep(seller) ? "/onboarding" : "/dashboard");
  }, [seller, router]);
  if (isLoading || seller) return <PageLoader />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 to-brand-600 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl">
        <p className="font-Poppins text-3xl font-extrabold text-brand-700">HUZA</p>
        <h1 className="mt-2 text-2xl font-semibold">Provider portal</h1>
        <p className="muted mt-2">List your wedding services, manage bookings and get paid every Thursday to MoMo or your bank.</p>
        <div className="mt-6 grid gap-3">
          <Link href="/signup" className="btn-primary py-3">Join as a provider</Link>
          <Link href="/login" className="btn-outline py-3">Log in</Link>
        </div>
      </div>
    </div>
  );
}
