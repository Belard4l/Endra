"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAdmin from "@/hooks/useAdmin";
import { PageLoader } from "@/components/ui";

export default function AdminHome() {
  const { admin, isLoading } = useAdmin();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading) router.replace(admin ? "/dashboard" : "/login");
  }, [admin, isLoading, router]);
  return <PageLoader />;
}
