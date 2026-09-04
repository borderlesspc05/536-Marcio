"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

type PublicHeaderProps = {
  blogUrl?: string;
};

export function PublicHeader({
  blogUrl = process.env.NEXT_PUBLIC_BLOG_URL ?? "https://blog.cotacondo.com.br",
}: PublicHeaderProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (value) => setScrolled(value > 12));

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links: NavLink[] = [
    { href: "/fornecedores", label: "Para Fornecedores" },
    { href: "/#cotacao", label: "Fazer cotação" },
    { href: blogUrl, label: "Blog", external: true },
    { href: "/acesse", label: "Acesse" },
  ];

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-0 right-0 top-6 z-50 flex justify-center px-4"
      >
        <div
          className={cn(
            "flex h-16 w-full max-w-[1280px] items-center justify-between gap-6 rounded-2xl border border-white/15 bg-[#102A43] px-5 shadow-[0_12px_36px_-16px_rgba(7,26,43,0.65)] backdrop-blur-[28px] transition-shadow",
            scrolled && "shadow-[0_16px_44px_-14px_rgba(7,26,43,0.8)]",
          )}
        >
          <Logo priority className="h-10 md:h-12" />

          <nav className="hidden items-center gap-7 md:flex">
            {links.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-[#D9E2EC] transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm font-semibold text-[#D9E2EC] transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>

          <div className="hidden md:block">
            <Link href="/cadastro">
              <Button size="sm" className="gap-2 pl-4 pr-2">
                Começar agora
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#A7115F]">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Button>
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-sm md:hidden"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed inset-y-0 right-0 z-[60] w-[min(320px,88vw)] border-l border-[#A7115F]/15 bg-gradient-to-br from-[#FFF1F7] to-[#EAF2F7] p-6 shadow-2xl backdrop-blur-[40px] md:hidden"
            >
              <div className="mb-8 flex items-center justify-between">
                <Logo href={null} className="h-10" />
                <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {links.map((link) =>
                  link.external ? (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-base font-medium"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="text-base font-medium"
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ),
                )}
                <Link href="/cadastro" onClick={() => setOpen(false)}>
                  <Button className="w-full">Começar agora</Button>
                </Link>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
