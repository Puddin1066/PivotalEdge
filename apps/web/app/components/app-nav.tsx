"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/ops", label: "Ops" },
  { href: "/platform", label: "Platform" },
  { href: "/radar", label: "Radar" },
  { href: "/dossier", label: "Dossier" },
  { href: "/backtest", label: "Backtest" },
  { href: "/paper", label: "Paper" },
];

/** Global strip for legacy pages; Ops has its own chrome. */
export function AppNav() {
  const pathname = usePathname();
  if (pathname === "/ops" || pathname.startsWith("/ops/")) return null;

  return (
    <nav className="border-b border-line bg-panel/95">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/ops" className="font-display text-sm font-semibold text-ink">
          PivotalEdge
        </Link>
        {NAV.map((item) => {
          const active =
            item.href === "/ops"
              ? pathname === "/ops" || pathname.startsWith("/ops/")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm ${active ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
