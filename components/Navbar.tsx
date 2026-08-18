"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import SunIcon from "@heroicons/react/24/outline/SunIcon";
import MoonIcon from "@heroicons/react/24/outline/MoonIcon";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import PhotoIconOutline from "@heroicons/react/24/outline/PhotoIcon";
import AdjustmentsHorizontalIconOutline from "@heroicons/react/24/outline/AdjustmentsHorizontalIcon";
import BookmarkIconOutline from "@heroicons/react/24/outline/BookmarkIcon";
import ArrowDownTrayIconOutline from "@heroicons/react/24/outline/ArrowDownTrayIcon";

import PhotoIconSolid from "@heroicons/react/24/solid/PhotoIcon";
import AdjustmentsHorizontalIconSolid from "@heroicons/react/24/solid/AdjustmentsHorizontalIcon";
import BookmarkIconSolid from "@heroicons/react/24/solid/BookmarkIcon";
import ArrowDownTrayIconSolid from "@heroicons/react/24/solid/ArrowDownTrayIcon";
import CheckCircleIconSolid from "@heroicons/react/24/solid/CheckCircleIcon";

import { getQueueManager } from "@/lib/queue/manager";
import { QueueSummary } from "@/lib/queue/types";

export function Navbar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [summary, setSummary] = useState<QueueSummary>({
    total: 0,
    queued: 0,
    processing: 0,
    done: 0,
    error: 0,
    progressPct: 0,
    isProcessing: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem("forma_theme") as "dark" | "light" | null;
    const initialTheme = saved === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");

    const queue = getQueueManager();
    const unsub = queue.subscribe((_, sum) => {
      setSummary(sum);
    });
    return unsub;
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("forma_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const navItems = [
    {
      href: "/",
      label: "Koleksi",
      iconOutline: PhotoIconOutline,
      iconSolid: PhotoIconSolid,
    },
    {
      href: "/edit",
      label: "Editor",
      iconOutline: AdjustmentsHorizontalIconOutline,
      iconSolid: AdjustmentsHorizontalIconSolid,
    },
    {
      href: "/presets",
      label: "Preset",
      iconOutline: BookmarkIconOutline,
      iconSolid: BookmarkIconSolid,
    },
    {
      href: "/export",
      label: "Ekspor",
      iconOutline: ArrowDownTrayIconOutline,
      iconSolid: ArrowDownTrayIconSolid,
    },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between gap-4">
          {/* Brand Logo & Title */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-medium tracking-tight text-foreground hover:opacity-90 transition-all active:scale-95"
          >
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm ring-1 ring-border/60 flex items-center justify-center bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="FORMA Logo"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold leading-none tracking-wide text-xs sm:text-sm">
                FORMA
              </span>
              <span className="text-[10px] text-muted-foreground tracking-normal font-normal">
                Finishing Visual
              </span>
            </div>
          </Link>

          {/* Right Header Utilities: Queue Pill & Theme Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Active Queue Status Indicator */}
            {summary.total > 0 && (
              <Link
                href="/export"
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-border/60 bg-card/80 backdrop-blur-md text-card-foreground shadow-sm hover:border-primary transition-all active:scale-95"
              >
                {summary.isProcessing ? (
                  <ArrowPathIcon className="w-3.5 h-3.5 text-accent animate-spin" />
                ) : summary.done === summary.total ? (
                  <CheckCircleIconSolid className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
                <span className="font-medium text-[11px] sm:text-xs">
                  {summary.done} / {summary.total} selesai
                </span>
              </Link>
            )}

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              type="button"
              aria-label={`Ganti ke mode ${theme === "dark" ? "terang" : "gelap"}`}
              title={`Ganti ke mode ${theme === "dark" ? "terang" : "gelap"}`}
              className="w-8 h-8 rounded-xl border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary bg-card/60 shadow-sm"
            >
              {theme === "dark" ? (
                <SunIcon className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
              ) : (
                <MoonIcon className="w-4 h-4 text-slate-700 transition-transform duration-300" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Apple HIG Floating Bottom Navigation Dock */}
      <div className="fixed bottom-5 inset-x-0 z-40 flex justify-center px-4 pointer-events-none animate-slide-up">
        <nav
          aria-label="Navigasi Utama"
          className="pointer-events-auto inline-flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-2xl bg-card/85 dark:bg-card/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/50 ring-1 ring-black/5 dark:ring-white/5"
        >
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = isActive ? item.iconSolid : item.iconOutline;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 py-2 px-3.5 sm:px-4 rounded-xl transition-all duration-200 active:scale-95 ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
                }`}
              >
                <Icon className={`w-4 h-4 sm:w-[18px] sm:h-[18px] transition-transform duration-200 ${isActive ? "scale-105" : ""}`} />
                <span className="text-xs tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
