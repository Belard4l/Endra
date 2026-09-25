"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import useUser from "@/hooks/useUser";
import { PageLoader } from "./ui";

/** Wraps pages that need a logged-in couple */
const RequireUser = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
  }, [isLoading, user, router, pathname]);
  if (isLoading || !user) return <PageLoader />;
  return <>{children}</>;
};

export default RequireUser;
