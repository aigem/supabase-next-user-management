'use client'
import React from "react";
import Link from "next/link";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  asLink?: boolean;
  href?: string;
  className?: string;
};

const base = "inline-flex items-center justify-center rounded px-4 py-2 text-sm transition-colors";
const variants: Record<string, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  ghost: "bg-transparent text-blue-600 hover:bg-blue-50",
};

export default function Button(props: ButtonProps) {
  const { variant = "primary", asLink = false, href, className = "", children, ...rest } = props;
  const cls = [base, variants[variant] ?? variants.primary, className].join(" ");
  if (asLink && href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button {...rest} className={cls}>
      {children}
    </button>
  );
}