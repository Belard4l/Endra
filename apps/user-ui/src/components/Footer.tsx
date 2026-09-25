"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const Footer = () => {
  const { t } = useI18n();
  return (
    <footer className="mt-20 border-t border-stone-200 bg-white">
      <div className="container-x grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <p className="font-Poppins text-xl font-extrabold text-brand-700">HUZA</p>
          <p className="mt-2 text-sm text-stone-500">{t("footer.tagline")}</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/services">{t("nav.services")}</Link>
          <Link href="/providers">{t("nav.providers")}</Link>
          <Link href="/how-it-works">{t("nav.howItWorks")}</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/become-provider">{t("nav.becomeProvider")}</Link>
          <Link href="/how-it-works#policies">Cancellation & refund policy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
      <p className="border-t border-stone-100 py-4 text-center text-xs text-stone-400">© {new Date().getFullYear()} HUZA · Kigali, Rwanda</p>
    </footer>
  );
};

export default Footer;
