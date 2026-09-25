import crypto from "crypto";

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const uniqueSlug = (text: string): string => `${slugify(text) || "service"}-${crypto.randomBytes(3).toString("hex")}`;

export const randomId = (bytes = 6): string => crypto.randomBytes(bytes).toString("hex");
