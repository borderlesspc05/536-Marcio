"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Mascot } from "@/components/brand/Mascot";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useEffect } from "react";

type SupplierHeroProps = {
  videoUrl?: string | null;
};

function getYouTubeEmbedUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let videoId = "";
    if (host === "youtu.be") videoId = url.pathname.slice(1).split("/")[0] ?? "";
    if (["youtube.com", "m.youtube.com"].includes(host)) {
      videoId = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1] ?? "";
    }
    if (!/^[\w-]{6,20}$/.test(videoId)) return null;
    const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
  } catch {
    return null;
  }
}

export function SupplierHero({ videoUrl }: SupplierHeroProps) {
  const embedUrl = getYouTubeEmbedUrl(videoUrl);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }
    if (Object.keys(utm).length > 0) {
      window.sessionStorage.setItem("cotacondo_utm", JSON.stringify(utm));
    }
  }, []);

  return (
    <section className="relative overflow-hidden pt-28 pb-16 lg:pt-32 lg:pb-20">
      <div className="pointer-events-none absolute top-[10%] right-[8%] -z-10 h-[400px] w-[400px] rounded-full bg-[#c10089]/[0.11] blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[6%] left-[6%] -z-10 h-[320px] w-[320px] rounded-full bg-[#00aab3]/[0.09] blur-[110px]" />

      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <h1 className="text-[36px] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#00535a] sm:text-[44px] lg:text-[52px]">
              Receba oportunidades de negócios, aumente a base de clientes e se conecte com o
              mercado.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-black/60">
              Chega de mandar proposta sem ter retorno e perder tempo enviando proposta no escuro.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/cadastro?tipo=fornecedor">
                <Button size="lg" className="group pl-6 pr-2">
                  Criar conta de fornecedor
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#c10089] transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              </Link>
              <Link href="#planos-fornecedor" className="text-sm font-bold text-[#c10089]">
                Ver planos
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center lg:col-span-6 lg:justify-end"
          >
            {embedUrl ? (
              <div className="relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-[#c10089]/15 bg-[#00535a] shadow-[0_28px_70px_-34px_rgba(16,42,67,0.85)]">
                <div className="aspect-video">
                  <iframe
                    src={embedUrl}
                    title="Conheça a CotaCondo para fornecedores"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="eager"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </div>
            ) : (
              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : { y: [0, -10, 0], rotate: [-1.5, 1.5, -1.5] }
                }
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative mr-[8%] mt-4 sm:mr-[14%]"
              >
                <Mascot
                  priority
                  className="relative z-10 w-full max-w-[330px] sm:max-w-[390px]"
                />
              </motion.div>
            )}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
