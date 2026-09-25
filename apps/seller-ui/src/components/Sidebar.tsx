"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BadgeCheck, Bell, CalendarCheck, CalendarDays, Gavel, LayoutDashboard, List, LogOut, Menu, MessageCircleQuestion, Settings, Star, Wallet, X,
} from "lucide-react";
import api from "@/lib/api";
import useSeller from "@/hooks/useSeller";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/services", label: "My services", icon: List },
  { href: "/availability", label: "Availability", icon: CalendarDays },
  { href: "/questions", label: "Questions", icon: MessageCircleQuestion },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/payouts", label: "Payouts", icon: Wallet },
  { href: "/penalties", label: "Fines & strikes", icon: Gavel },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/verification", label: "Verification", icon: BadgeCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { seller } = useSeller();
  const [open, setOpen] = useState(false);
  const { data: unread } = useQuery({
    queryKey: ["unread"],
    queryFn: async () => (await api.get("/booking/api/seller/notifications?limit=1")).data.unread as number,
    refetchInterval: 60000,
  });
  const logout = async () => {
    await api.post("/auth/api/logout-seller").catch(() => undefined);
    qc.clear();
    router.push("/login");
  };
  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((i) => {
        const active = pathname === i.href || (i.href !== "/dashboard" && pathname?.startsWith(i.href));
        return (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-700 text-white" : "text-stone-700 hover:bg-stone-100"}`}>
            <i.icon size={18} /> {i.label}
            {i.href === "/notifications" && !!unread && <span className="ml-auto rounded-full bg-brand-600 px-2 text-xs text-white">{unread}</span>}
          </Link>
        );
      })}
      <button onClick={logout} className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
        <LogOut size={18} /> Log out
      </button>
    </nav>
  );
  return (
    <>
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-Poppins text-xl font-extrabold text-brand-700">HUZA</span>
        <button onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && <div className="border-b border-stone-200 bg-white p-4 lg:hidden">{nav}</div>}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-stone-200 bg-white p-5 lg:flex">
        <div>
          <p className="font-Poppins text-2xl font-extrabold text-brand-700">HUZA</p>
          <p className="truncate text-sm text-stone-500">{seller?.shop?.name || seller?.name}</p>
        </div>
        {nav}
      </aside>
    </>
  );
};

export default Sidebar;
