"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

const useAdmin = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      try {
        return (await api.get("/auth/api/logged-in-admin")).data.admin as { id: string; name: string; email: string };
      } catch {
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { admin: data ?? null, isLoading };
};

export default useAdmin;
