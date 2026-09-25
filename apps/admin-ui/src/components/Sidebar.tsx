"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarCheck, Gavel, LayoutDashboard, LogOut, MessageCircleQuestion, Scale, Settings, Store, Tags, Users, Wallet } from "lucide-react";
import api from "@/lib/api";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/providers", label: "Providers", icon: Store, badge: "pendingVerification" },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/disputes", label: "Disputes", icon: Scale, badge: "openDisputes" },
  { href: "/penalties", label: "Fines & appeals", icon: Gavel, badge: "appeals" },
  { href: "/payouts", label: "Payouts", icon: Wallet, badge: "failedPayouts" },
  { href: "/users", label: "Users & admins", icon: Users },
  { href: "/questions", label: "Q&A moderation", icon: MessageCircleQuestion },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-dashboard"], queryFn: async () => (await api.get("/admin/api/dashboard")).data, refetchInterval: 120000 });
  const stats = data?.stats || {};
  const logout = async () => {
    await api.post("/auth/api/logout-admin").catch(() => undefined);
    qc.clear();
    router.push("/login");
  };
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 bg-stone-900 p-4 text-stone-200 lg:sticky lg:top-0 lg:h-screen lg:w-60">
      <p className="font-Poppins text-xl font-extrabold text-white">HUZA <span className="text-brand-400">Admin</span></p>
      <nav className="flex flex-1 flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
        {items.map((i) => {
          const active = pathname === i.href || (i.href !== "/dashboard" && pathname?.startsWith(i.href));
          const count = i.badge ? stats[i.badge] : 0;
          return (
            <Link key={i.href} href={i.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active ? "bg-brand-700 text-white" : "hover:bg-stone-800"}`}>
              <i.icon size={17} /> {i.label}
              {!!count && <span className="ml-auto rounded-full bg-brand-500 px-2 text-xs text-white">{count}</span>}
            </Link>
          );
        })}
      </nav>
      <button onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-stone-800"><LogOut size={17} /> Log out</button>
    </aside>
  );
};

export default Sidebar;
