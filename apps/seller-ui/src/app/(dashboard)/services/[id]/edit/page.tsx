"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import ServiceForm, { fromService } from "@/components/ServiceForm";
import { PageLoader } from "@/components/ui";

export default function EditService() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({ queryKey: ["my-service", id], queryFn: async () => (await api.get(`/catalog/api/seller/services/${id}`)).data.service });
  if (isLoading || !data) return <PageLoader />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit listing</h1>
      <ServiceForm initial={fromService(data)} serviceId={id} />
    </div>
  );
}
