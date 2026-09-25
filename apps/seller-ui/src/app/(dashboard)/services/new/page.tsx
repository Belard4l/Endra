"use client";
import ServiceForm, { emptyService } from "@/components/ServiceForm";
import useSeller from "@/hooks/useSeller";

export default function NewService() {
  const { seller } = useSeller();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New listing</h1>
      <ServiceForm initial={emptyService(seller?.shop?.category || "")} />
    </div>
  );
}
