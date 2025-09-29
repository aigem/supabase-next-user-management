'use client'
import React from "react";

export default function Card({
  children,
  className = "",
  title,
  footer,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className={["rounded-lg border p-4", className].join(" ")}>
      {title ? <div className="mb-2 text-sm text-gray-500">{title}</div> : null}
      {children}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  );
}