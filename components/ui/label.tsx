import * as React from "react";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({
  children,
  className,
  required,
  ...props
}: LabelProps) {
  return (
    <label
      className={`mb-2 block text-sm font-medium text-slate-700 ${className || ""}`}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}