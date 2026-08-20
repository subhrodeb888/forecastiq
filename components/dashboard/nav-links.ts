import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  Users,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Brain,
  BarChart3,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";

export type NavGroup = "overview" | "inventory" | "transactions" | "intelligence";

export interface NavLink {
  title: string;
  href: string;
  icon: LucideIcon;
  group: NavGroup;
}

export const navLinks: NavLink[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "overview" },
  { title: "Products", href: "/products", icon: Package, group: "inventory" },
  { title: "Categories", href: "/categories", icon: Tags, group: "inventory" },
  { title: "Suppliers", href: "/suppliers", icon: Users, group: "inventory" },
  { title: "Expiry", href: "/expiry", icon: CalendarClock, group: "inventory" },
  { title: "Reorder", href: "/reorder", icon: AlertTriangle, group: "inventory" },
  { title: "Purchases", href: "/purchases", icon: ShoppingCart, group: "transactions" },
  { title: "Sales", href: "/sales", icon: Receipt, group: "transactions" },
  { title: "Forecasts", href: "/forecast", icon: TrendingUp, group: "intelligence" },
  // AI Insights aliases /reorder — the reorder engine is the insights surface.
  { title: "AI Insights", href: "/reorder", icon: Brain, group: "intelligence" },
  { title: "Reports", href: "/reports", icon: BarChart3, group: "intelligence" },
];

export const groupLabels: Record<NavGroup, string> = {
  overview: "Overview",
  inventory: "Inventory",
  transactions: "Transactions",
  intelligence: "Intelligence",
};

export const groupOrder: NavGroup[] = [
  "overview",
  "inventory",
  "transactions",
  "intelligence",
];