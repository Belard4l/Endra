"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { I18nProvider } from "@/lib/i18n";

const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 60 * 1000 } },
      })
  );

  // PWA: register the service worker (installable app, basic offline page)
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        {children}
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      </I18nProvider>
    </QueryClientProvider>
  );
};

export default Providers;
