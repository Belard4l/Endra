import "./global.css";
import type { Metadata } from "next";
import { Poppins, Roboto } from "next/font/google";
import Providers from "./app-providers";

export const metadata: Metadata = {
  title: { default: "HUZA for Providers", template: "%s · HUZA Providers" },
  description: "Manage your wedding services, bookings and payouts on HUZA.",
  icons: { icon: "/icons/icon-192.png" },
};

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-poppins" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${poppins.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
