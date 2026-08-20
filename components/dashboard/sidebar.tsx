"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, X, Menu, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { navLinks, groupLabels, groupOrder } from "./nav-links";
import { SidebarItem } from "./sidebar-item";

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const grouped = groupOrder.map((group) => ({
    key: group,
    label: groupLabels[group],
    links: navLinks.filter((link) => link.group === group),
  }));

  return (
    <>
      {/* Mobile toggle — lives in the sidebar component so layout.tsx doesn't need to change */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200 px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xl font-bold text-slate-900"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <TrendingUp className="size-4" />
            </span>
            ForecastIQ
          </Link>

          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.key}>
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </h3>
                <div className="space-y-0.5">
                  {group.links.map((link) => (
                    <SidebarItem
                      key={link.href}
                      href={link.href}
                      icon={link.icon}
                      label={link.title}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 p-4">
          <form
            action={async () => {
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut className="size-5 text-slate-400" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
