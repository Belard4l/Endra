"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Category } from "@/lib/types";

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get("/catalog/api/categories");
      return data as { categories: Category[]; districts: string[] };
    },
    staleTime: 30 * 60 * 1000,
  });

export const categoryName = (cats: Category[] | undefined, slug: string, lang = "en") => {
  const c = cats?.find((x) => x.slug === slug);
  if (!c) return slug;
  return lang === "rw" && c.nameRw ? c.nameRw : c.name;
};
