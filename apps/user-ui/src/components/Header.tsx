"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarHeart, Heart, Menu, Search, ShoppingBag, User as UserIcon, X } from "lucide-react";
import useUser from "@/hooks/useUser";
import { useStore } from "@/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";

const Header = () => {
  const { t, lang, setLang } = useI18n();
  const { user, isLoading } = useUser();
  const basketCount = useStore((s) => s.basket.length);
  const savedCount = useStore((s) => s.saved.length);
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ["unread", user?.id],
    enabled: Boolean(user),
    queryFn: async () => (await api.get("/booking/api/notifications?limit=1")).data.unread as number,
    refetchInterval: 60000,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/services?q=${encodeURIComponent(q.trim())}`);
    setMenu(false);
  };

  const logout = async () => {
    await api.post("/auth/api/logout-user").catch(() => undefined);
    qc.setQueryData(["user"], null);
    router.push("/");
  };

  const nav = [
    { href: "/services", label: t("nav.services") },
    { href: "/providers", label: t("nav.providers") },
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/become-provider", label: t("nav.becomeProvider") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-4">
        <button className="lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">
          {menu ? <X /> : <Menu />}
        </button>
        <Link href="/" className="font-Poppins text-2xl font-extrabold tracking-wide text-brand-700">
          HUZA
        </Link>
        <nav className="ml-4 hidden items-center gap-5 text-sm font-medium lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={pathname?.startsWith(n.href) ? "text-brand-700" : "text-stone-700 hover:text-brand-700"}>
              {n.label}
            </Link>
          ))}
        </nav>
        <form onSubmit={submit} className="relative ml-auto hidden max-w-sm flex-1 md:block">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} className="input pr-10" />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500" aria-label={t("search.button")}>
            <Search size={18} />
          </button>
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            onClick={() => setLang(lang === "en" ? "rw" : "en")}
            className="rounded-md px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100"
            title="Language / Ururimi"
          >
            {lang === "en" ? "RW" : "EN"}
          </button>
          <Link href="/saved" className="relative rounded-full p-2 hover:bg-stone-100" aria-label={t("nav.saved")}>
            <Heart size={20} />
            {savedCount > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{savedCount}</span>}
          </Link>
          <Link href="/basket" className="relative rounded-full p-2 hover:bg-stone-100" aria-label={t("nav.basket")}>
            <ShoppingBag size={20} />
            {basketCount > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{basketCount}</span>}
          </Link>
          {user && (
            <Link href="/notifications" className="relative rounded-full p-2 hover:bg-stone-100" aria-label={t("nav.notifications")}>
              <Bell size={20} />
              {!!unread && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          )}
          {user ? (
            <div className="group relative">
              <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-stone-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-sm font-medium sm:block">{user.name.split(" ")[0]}</span>
              </button>
              <div className="invisible absolute right-0 top-full w-52 rounded-xl border border-stone-200 bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                <Link href="/bookings" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-stone-50">
                  <CalendarHeart size={16} /> {t("nav.bookings")}
                </Link>
                <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-stone-50">
                  <UserIcon size={16} /> {t("nav.account")}
                </Link>
                <button onClick={logout} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-stone-50">
                  {t("nav.logout")}
                </button>
              </div>
            </div>
          ) : (
            <Link href="/login" className="btn-primary ml-1 py-2">
              {isLoading ? "…" : t("nav.login")}
            </Link>
          )}
        </div>
      </div>
      {menu && (
        <div className="border-t border-stone-200 bg-white px-4 py-4 lg:hidden">
          <form onSubmit={submit} className="relative mb-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} className="input pr-10" />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500">
              <Search size={18} />
            </button>
          </form>
          <div className="flex flex-col">
            {[...nav, ...(user ? [{ href: "/bookings", label: t("nav.bookings") }, { href: "/profile", label: t("nav.account") }] : [])].map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMenu(false)} className="py-2 font-medium">
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
