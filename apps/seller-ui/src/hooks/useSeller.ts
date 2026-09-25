"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export type Seller = {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  accountType: "individual" | "company";
  paymentMethod?: "momo" | "bank" | null;
  momoPhoneNumber?: string | null;
  momoNetwork?: string | null;
  momoName?: string | null;
  bankName?: string | null;
  bankCode?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  verificationStatus: "unsubmitted" | "pending" | "approved" | "rejected";
  verificationNote?: string | null;
  rdbNumber?: string | null;
  nationalIdDoc?: { name?: string; uploaded: boolean } | null;
  rdbCertificateDoc?: { name?: string; uploaded: boolean } | null;
  status: "active" | "restricted" | "suspended" | "banned";
  activeStrikes: number;
  completedCount: number;
  visibilityScore: number;
  shop?: any;
};

const useSeller = () => {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["seller"],
    queryFn: async (): Promise<Seller | null> => {
      try {
        return (await api.get("/auth/api/logged-in-seller")).data.seller;
      } catch {
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });
  return { seller: data ?? null, isLoading, refetch, setSeller: (s: Seller | null) => qc.setQueryData(["seller"], s) };
};

export default useSeller;

/** Onboarding step the provider still needs to finish (null = done) */
export const nextOnboardingStep = (s: Seller | null) => {
  if (!s) return null;
  if (!s.shop) return 2;
  if (!s.paymentMethod) return 3;
  if (s.verificationStatus === "unsubmitted" || s.verificationStatus === "rejected") return 4;
  return null;
};
