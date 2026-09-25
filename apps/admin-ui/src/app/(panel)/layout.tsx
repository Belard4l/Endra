"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAdmin from "@/hooks/useAdmin";
import Sidebar from "@/components/Sidebar";
import { PageLoader } from "@/components/ui";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin, isLoading } = useAdmin();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !admin) router.replace("/login");
  }, [admin, isLoading, router]);
  if (isLoading || !admin) return <PageLoader />;
  return (
    <div className="flex min-h-screen flex-col bg-sand lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}
