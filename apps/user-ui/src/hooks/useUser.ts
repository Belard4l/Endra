"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  language: string;
  weddingDate?: string | null;
  weddingDistrict?: string | null;
  budget?: number | null;
  avatar?: { url: string } | null;
};

const fetchUser = async (): Promise<User | null> => {
  try {
    const { data } = await api.get("/auth/api/logged-in-user");
    return data.user;
  } catch {
    return null; // not logged in — not an error
  }
};

/** Fetches the session once (no retry loop, no refetch on window focus) */
const useUser = () => {
  const qc = useQueryClient();
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { user: user ?? null, isLoading, refetch, setUser: (u: User | null) => qc.setQueryData(["user"], u) };
};

export default useUser;
