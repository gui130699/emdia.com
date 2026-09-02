import type { ReactNode } from "react";
import { labelClass, errorClass } from "./formStyles";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}

export default function FormField({ label, htmlFor, error, children }: FormFieldProps) {
  return (
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}
