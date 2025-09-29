'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/recharge", label: "充值" },
  { href: "/usage", label: "报表" },
  { href: "/invites", label: "邀请" },
  { href: "/console", label: "控制台" },
  { href: "/account", label: "账户", align: "right" as const },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto max-w-5xl flex items-center gap-4 p-4 text-sm">
      {items.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "hover:underline",
              isActive ? "font-semibold underline" : "",
              item.align === "right" ? "ml-auto" : "",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}