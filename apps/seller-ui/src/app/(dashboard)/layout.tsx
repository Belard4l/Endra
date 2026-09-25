"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSeller, { nextOnboardingStep } from "@/hooks/useSeller";
import Sidebar from "@/components/Sidebar";
import { PageLoader } from "@/components/ui";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { seller, isLoading } = useSeller();
  const router = useRouter();
  useEffect(() => {
    if (isLoading) return;
    if (!seller) router.replace("/login");
    else if (!seller.shop) router.replace("/onboarding");
  }, [isLoading, seller, router]);
  if (isLoading || !seller || !seller.shop) return <PageLoader />;

  const banners: { tone: string; text: React.ReactNode }[] = [];
  if (seller.status === "banned") banners.push({ tone: "bg-red-600 text-white", text: "Your account is banned. Contact HUZA support." });
  else if (seller.status === "suspended") banners.push({ tone: "bg-red-100 text-red-900", text: <>Your account is suspended (3+ active strikes): listings are hidden and you can't take new bookings. <Link href="/penalties" className="underline">Details</Link></> });
  else if (seller.status === "restricted") banners.push({ tone: "bg-amber-100 text-amber-900", text: <>You have 2 active strikes, so your listings appear lower in search. <Link href="/penalties" className="underline">Details</Link></> });
  if (seller.verificationStatus === "pending") banners.push({ tone: "bg-sky-50 text-sky-900", text: "Your documents are being reviewed. Listings go live once you're verified." });
  if (seller.verificationStatus === "rejected" || seller.verificationStatus === "unsubmitted")
    banners.push({ tone: "bg-amber-50 text-amber-900", text: <>Verify your identity to publish listings. <Link href="/verification" className="underline">Verify now</Link></> });
  if (nextOnboardingStep(seller) === 3) banners.push({ tone: "bg-amber-50 text-amber-900", text: <>Add a MoMo or bank payout method. <Link href="/settings" className="underline">Add now</Link></> });

  return (
    <div className="flex min-h-screen flex-col bg-sand lg:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">
        {banners.map((b, i) => (
          <div key={i} className={`px-6 py-2.5 text-sm ${b.tone}`}>{b.text}</div>
        ))}
        <div className="mx-auto max-w-6xl p-4 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
