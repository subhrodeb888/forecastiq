import Link from "next/link";
import { Metadata } from "next";
import {
  TrendingUp,
  Package,
  BarChart3,
  FileText,
  Users,
  Zap,
  ArrowRight,
  CheckCircle2,
  BrainCircuit,
  LineChart,
  ShoppingCart,
  AlertTriangle,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";

export const metadata: Metadata = {
  title: "ForecastIQ — Demand Forecasting & Inventory Intelligence",
  description:
    "ML-powered demand forecasting for your products. Prevent stockouts, cut carrying costs, and make purchase decisions with confidence.",
  openGraph: {
    title: "ForecastIQ — Demand Forecasting & Inventory Intelligence",
    description:
      "ML-powered demand forecasting for your products. Prevent stockouts, cut carrying costs, and make purchase decisions with confidence.",
    type: "website",
  },
};

/* ─── Component Recipes (match existing dashboard exactly) ─── */

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "emerald" | "amber";
}) {
  const toneMap = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${toneMap[tone]}`}
    >
      {children}
    </span>
  );
}

function PrimaryButton({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
      {icon}
    </Link>
  );
}

function GhostButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/* ─── Sections ─── */

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <TrendingUp className="size-4" />
          </span>
          ForecastIQ
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a
            href="#features"
            className="transition-colors hover:text-slate-900"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="transition-colors hover:text-slate-900"
          >
            How it works
          </a>
          <a href="#modules" className="transition-colors hover:text-slate-900">
            Dashboard
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block"
          >
            Log in
          </Link>
          <PrimaryButton
            href="/login"
            icon={<ChevronRight className="size-4" />}
          >
            Get started
          </PrimaryButton>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center">
            <Badge tone="blue">
              <Zap className="mr-1 size-3" />
              Now with Holt-Winters &amp; Linear Trend models
            </Badge>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl sm:leading-tight">
            Predict demand.
            <br />
            <span className="text-blue-600">Optimize inventory.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            ForecastIQ connects your sales history to machine learning models
            running on a dedicated FastAPI service. Generate forecasts, track
            stock levels, and make purchase decisions — all in one place.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PrimaryButton
              href="/login"
              icon={<ArrowRight className="size-4" />}
            >
              Start forecasting free
            </PrimaryButton>
            <GhostButton href="/login">View dashboard</GhostButton>
          </div>

          <div className="mt-10 flex items-center justify-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              No credit card
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Google sign-in
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Export to CSV
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-6 transition-shadow hover:shadow-md">
      <div className="mb-4 inline-flex rounded-lg bg-blue-50 p-3 text-blue-600">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {description}
      </p>
    </Card>
  );
}

function Features() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Everything you need to stay ahead of demand
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            From automated forecasting to supplier management, ForecastIQ turns
            your operational data into actionable inventory intelligence.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<BrainCircuit className="size-6" />}
            title="ML Demand Forecasting"
            description="Run Moving Average, Linear Trend, or Holt-Winters models against your historical sales. Confidence intervals and bounds included."
          />
          <FeatureCard
            icon={<Package className="size-6" />}
            title="Inventory Control"
            description="Track products, categories, and suppliers. Low-stock and out-of-stock alerts keep you ahead of shortages."
          />
          <FeatureCard
            icon={<LineChart className="size-6" />}
            title="Revenue Analytics"
            description="Real-time KPIs for sales, revenue, and purchase trends. Slice by month, product, or category with INR formatting."
          />
          <FeatureCard
            icon={<FileText className="size-6" />}
            title="Exportable Reports"
            description="Generate forecast and inventory reports. Download CSVs of your predictions, sales history, and stock levels."
          />
          <FeatureCard
            icon={<Users className="size-6" />}
            title="Team-Ready Auth"
            description="Secure Google OAuth via NextAuth v5 with Drizzle adapter. Role-ready architecture for your entire operations team."
          />
          <FeatureCard
            icon={<Zap className="size-6" />}
            title="FastAPI Microservice"
            description="Heavy ML workloads run on an isolated FastAPI service so your Next.js dashboard stays fast and responsive."
          />
        </div>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex flex-col items-start">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
        {number}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {description}
      </p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-100 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            From data to decision in minutes
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            No spreadsheets. No statistical guesswork. Just your data and the
            model.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-12 sm:grid-cols-3">
          <Step
            number="1"
            title="Import your catalog"
            description="Add products, categories, and suppliers. Upload purchase and sales records via CSV or enter them directly."
          />
          <Step
            number="2"
            title="Run a forecast"
            description="Choose an algorithm and forecast horizon. The FastAPI service trains on your history and returns predicted demand with confidence bands."
          />
          <Step
            number="3"
            title="Purchase with confidence"
            description="Review forecast charts, stock alerts, and revenue trends to build your next purchase order with data-backed precision."
          />
        </div>
      </div>
    </section>
  );
}

function ModuleCard({
  icon,
  title,
  description,
  href,
  badges,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  badges?: string[];
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-sm leading-relaxed text-slate-600">{description}</p>
        {badges && (
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map((b) => (
              <Badge key={b} tone="blue">
                {b}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-auto pt-6">
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            Open {title}
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function Modules() {
  return (
    <section id="modules" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Your forecasting command center
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Three integrated modules. One source of truth for your inventory
            decisions.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
          <ModuleCard
            icon={<TrendingUp className="size-5" />}
            title="Forecast"
            description="Train models, view prediction charts with confidence bands, and browse your forecast history by product and date range."
            href="/forecast"
            badges={["Holt-Winters", "Linear Trend", "Moving Average"]}
          />
          <ModuleCard
            icon={<Package className="size-5" />}
            title="Inventory"
            description="Manage products, categories, and suppliers. Monitor stock levels and get alerted when items run low or hit zero."
            href="/products"
            badges={["Low-stock alerts", "Supplier tracking"]}
          />
          <ModuleCard
            icon={<BarChart3 className="size-5" />}
            title="Reports"
            description="Analyze revenue trends, monthly sales breakdowns, top-performing products, and inventory health at a glance."
            href="/reports"
            badges={["Revenue KPIs", "Top products", "Monthly trends"]}
          />
        </div>
      </div>
    </section>
  );
}

function EmptyStatePreview() {
  return (
    <section className="bg-slate-100 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Built for clarity, even when starting out
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Every module includes helpful empty states — so your team knows
            exactly what to do next.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <Card className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <ShoppingCart className="size-6 text-blue-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              No sales data yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Add your first purchase and sales records to start generating
              demand forecasts. You can upload a CSV or enter data manually.
            </p>
            <div className="mt-6">
              <PrimaryButton href="/login">Add sales data</PrimaryButton>
            </div>
          </Card>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle className="size-6 text-amber-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No low-stock items
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                All products are currently well-stocked. Alerts appear here when
                inventory falls below safe thresholds.
              </p>
            </Card>
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <LayoutDashboard className="size-6 text-blue-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No forecasts run yet
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Head to the Forecast module, select a model, and run your first
                prediction to see results here.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-2xl bg-blue-600 px-6 py-16 text-center sm:px-16">
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to stop guessing?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
              Start with your existing product catalog. Connect your sales
              history. Let the models show you what comes next.
            </p>
            <div className="mt-10 flex justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-slate-100"
              >
                Get started for free
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
              <TrendingUp className="size-4" />
            </span>
            ForecastIQ
          </div>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} ForecastIQ. Built with Next.js &amp;
            FastAPI.
          </p>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link
              href="/login"
              className="transition-colors hover:text-slate-900"
            >
              Sign in
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">v1.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Modules />
        <EmptyStatePreview />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
