import axios, { AxiosError } from "axios";

export const SERVER = process.env.NEXT_PUBLIC_SERVER_URI || "http://localhost:8080";

/** Talks to the API gateway. Paths start with the service: /auth, /catalog, /booking */
const api = axios.create({ baseURL: SERVER, withCredentials: true });

let refreshing: Promise<unknown> | null = null;

// Routes that must never trigger a login redirect
const NO_REDIRECT = ["/auth/api/logged-in-admin", "/auth/api/refresh-token-admin", "/auth/api/login-admin"];

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original: any = error.config;
    const url = original?.url || "";
    if (error.response?.status === 401 && !original?._retry && !url.includes("refresh-token")) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post(`${SERVER}/auth/api/refresh-token-admin`, {}, { withCredentials: true });
        await refreshing;
        refreshing = null;
        return api(original);
      } catch {
        refreshing = null;
        if (!NO_REDIRECT.some((p) => url.includes(p)) && typeof window !== "undefined") {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          if (!window.location.pathname.startsWith("/login")) window.location.href = `/login?next=${next}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export const errorMessage = (err: unknown, fallback = "Something went wrong. Please try again."): string => {
  const e = err as AxiosError<any>;
  return e?.response?.data?.message || e?.response?.data?.error || (e as any)?.message || fallback;
};

export default api;
