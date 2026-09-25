import "./global.css";
import type { Metadata, Viewport } from "next";
import { Poppins, Roboto } from "next/font/google";
import Providers from "./app-providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "HUZA — Wedding services in Rwanda", template: "%s · HUZA" },
  description: "Find, book and pay trusted wedding providers across Rwanda. Your money is held safely until each service is delivered.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "HUZA", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#9f1239", width: "device-width", initialScale: 1 };

const roboto = Roboto({ subsets: ["latin"], weight: ["300", "400", "500", "700"], variable: "--font-roboto" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-poppins" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${poppins.variable}`}>
        <Providers>
          <Header />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
