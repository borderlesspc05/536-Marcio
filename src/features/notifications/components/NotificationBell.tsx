"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useState } from "react";

type NotificationBellProps = {
  unreadCount: number;
};

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="relative">
      <Link
        href="/app/notificacoes"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#B9CAD8] bg-white text-[#173B57] shadow-sm transition-[background-color,border-color,color] hover:border-[#c10089]/40 hover:bg-[#FCE7F3] hover:text-[#c10089] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c10089]/40"
        aria-label={unreadCount > 0 ? `${unreadCount} notificações não lidas` : "Notificações"}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[#c10089] px-1 text-[10px] font-bold text-white ring-2 ring-[#F7FAFC]">
            {badge}
          </span>
        ) : null}
      </Link>
      {open && unreadCount > 0 ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-xl border border-[#CBD8E2] bg-white p-3 text-xs font-medium text-[#334E68] shadow-[0_14px_35px_-18px_rgba(15,42,67,0.55)]">
          {unreadCount} não lida{unreadCount === 1 ? "" : "s"}. Abrir central.
        </div>
      ) : null}
    </div>
  );
}
