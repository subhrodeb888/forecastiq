import * as React from "react";

export function TableContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${className || ""}`}
    >
      {children}
    </div>
  );
}

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${className || ""}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead className={`bg-slate-50 text-slate-500 ${className || ""}`}>
      {children}
    </thead>
  );
}

export function TableBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableRow({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const baseClasses = `border-t transition-colors hover:bg-slate-50 ${
    className || ""
  }`;

  if (href) {
    return (
      <tr className={baseClasses}>
        <td colSpan={100} className="p-0">
          <a href={href} className="contents">
            {children}
          </a>
        </td>
      </tr>
    );
  }

  return <tr className={baseClasses}>{children}</tr>;
}

export function TableHeader({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <th
      className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider ${alignClass} ${className || ""}`}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <td
      className={`px-6 py-4 text-sm text-slate-900 ${alignClass} ${className || ""}`}
    >
      {children}
    </td>
  );
}

export function TableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-12 text-center text-sm text-slate-500"
      >
        {children}
      </td>
    </tr>
  );
}
