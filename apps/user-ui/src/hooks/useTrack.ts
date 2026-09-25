"use client";
import api from "@/lib/api";

/** Records interest signals used for recommendations (ignored for visitors) */
export const track = (action: "save" | "unsave" | "add_to_basket" | "check_date", serviceId: string) => {
  api.post("/catalog/api/events", { action, serviceId }).catch(() => undefined);
};
