"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Category } from "@/lib/types";

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/catalog/api/categories")).data as { categories: Category[]; districts: string[] },
    staleTime: 30 * 60 * 1000,
  });
