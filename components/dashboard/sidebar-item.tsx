"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  onNavigate?: () => void;
}

export function SidebarItem({
  href,
  icon: Icon,
  label,
  onNavigate,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
        isActive
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={`size-5 shrink-0 transition-colors ${
          isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
