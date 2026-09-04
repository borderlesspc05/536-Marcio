"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Mascot } from "@/components/brand/Mascot";
import { logoutAction } from "@/features/auth/actions";
import { getNavItemsForSession, profileLabel } from "@/features/navigation/menu";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import type { MemberRole, OrganizationType } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import type { PlanFeatures } from "@/features/billing/plan-gate";

type AppShellProps = {
  children: React.ReactNode;
  unreadNotifications?: number;
  session: {
    name: string;
    email: string;
    organizationName: string;
    organizationType: OrganizationType;
    role: MemberRole;
  };
  features?: PlanFeatures;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarBrand({ name, profile }: { name: string; profile: string }) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-[#0B1F33] pb-4">
      <div className="flex min-h-[96px] items-center justify-center px-4 pb-4 pt-5">
        <Logo href="/app" priority className="h-11 max-w-[168px]" />
      </div>
      <div className="px-4">
        <div className="min-w-0 rounded-[14px] border border-white/15 bg-[#132F48] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="truncate text-[13px] font-bold text-white">{name}</p>
          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9FB3C8]">
            {profile}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children, session, unreadNotifications = 0, features }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = getNavItemsForSession({
    organizationType: session.organizationType,
    role: session.role,
    features,
  });
  const profile = profileLabel(session.organizationType, session.role);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  const nav = (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-[background-color,color,box-shadow,transform] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#102A43]",
              active
                ? "bg-white text-[#102A43] shadow-[0_7px_18px_-12px_rgba(3,18,32,0.9)]"
                : "text-slate-200 hover:bg-white/10 hover:text-white",
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition-colors", active ? "bg-[#FCE7F3] text-[#A7115F]" : "bg-white/5 text-slate-300 group-hover:bg-white/10 group-hover:text-white")}>
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="app-shell min-h-[100dvh] bg-[#EAF0F4]">
      <a href="#conteudo-principal" className="app-skip-link">Pular para o conteúdo</a>
      <div className="flex min-h-[100dvh]">
        <aside className="sticky top-0 hidden h-[100dvh] w-[232px] shrink-0 flex-col overflow-hidden bg-[#102A43] shadow-[12px_0_40px_-28px_rgba(15,42,67,0.8)] md:flex">
          <SidebarBrand name={session.name} profile={profile} />
          <div className="app-sidebar-nav min-h-0 flex-1 overflow-y-auto px-4 py-1">
            {nav}
          </div>
          <form action={logoutAction} className="mx-4 shrink-0 border-t border-white/10 py-3">
            <button
              type="submit"
              className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-300 transition-[background-color,color,transform] hover:bg-white/10 hover:text-white active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sair
            </button>
          </form>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-[#071A2B]/60 backdrop-blur-sm"
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Menu principal"
              className="absolute inset-y-0 left-0 flex w-[272px] flex-col overflow-hidden overscroll-contain bg-[#102A43] shadow-2xl"
            >
              <div className="absolute right-3 top-3 z-10">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-[#B9CAD8] bg-white p-2 text-[#102A43] shadow-sm transition-colors hover:border-[#A7115F]/35 hover:text-[#A7115F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7115F]/35"
                  aria-label="Fechar"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
              <SidebarBrand name={session.name} profile={profile} />
              <div className="app-sidebar-nav min-h-0 flex-1 overflow-y-auto px-4 py-1">
                {nav}
              </div>
              <form action={logoutAction} className="mx-4 shrink-0 border-t border-white/10 py-3">
                <button
                  type="submit"
                  className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  Sair
                </button>
              </form>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between gap-2.5 border-b border-[#CBD8E2] bg-[#F7FAFC]/95 px-4 py-2 backdrop-blur-xl md:px-7">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#B9CAD8] bg-white text-[#102A43] shadow-sm transition-colors hover:border-[#A7115F]/40 hover:text-[#A7115F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7115F]/40 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#102A43]">{session.organizationName}</p>
                <p className="truncate text-xs text-slate-500">{session.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <NotificationBell unreadCount={unreadNotifications} />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-[#102A43]">{session.name}</p>
                <p className="text-xs font-medium text-slate-500">{profile}</p>
              </div>
              <Mascot variant="avatar" className="h-9 w-9" />
            </div>
          </header>
          <main id="conteudo-principal" className="app-main flex-1 scroll-mt-20 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
