"use client";
import useSeller from "@/hooks/useSeller";
import { VerificationForm } from "@/components/forms";

export default function Verification() {
  const { seller } = useSeller();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Verification</h1>
      <div className="card p-6"><VerificationForm seller={seller} /></div>
    </div>
  );
}
