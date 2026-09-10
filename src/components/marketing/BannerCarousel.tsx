"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type BannerSlide = {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  scrollIntervalMs?: number;
};

const GRADIENTS = [
  "from-[#c10089] via-[#9a006e] to-[#00535a]",
  "from-[#00aab3] via-[#00535a] to-[#c10089]",
  "from-[#c10089] via-[#00aab3] to-[#00535a]",
  "from-[#00535a] via-[#00aab3] to-[#c10089]",
];

type BannerCarouselProps = {
  banners: BannerSlide[];
  compact?: boolean;
};

export function BannerCarousel({ banners, compact = false }: BannerCarouselProps) {
  const slides = banners.slice(0, 10);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setIndex((current) => (current + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setIndex((current) => (current - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const interval = slides[index]?.scrollIntervalMs ?? 5500;
    const timer = window.setInterval(next, Math.max(2000, interval));
    return () => window.clearInterval(timer);
  }, [next, paused, slides, index]);

  if (slides.length === 0) return null;

  const current = slides[index]!;

  const content = (
    <div
      className={`relative flex w-full items-end overflow-hidden bg-gradient-to-br ${
        compact
          ? "min-h-[140px] sm:min-h-[170px] lg:min-h-[190px]"
          : "min-h-[150px] sm:min-h-[210px] lg:min-h-[250px]"
      } ${GRADIENTS[index % GRADIENTS.length]}`}
    >
      {/* imageUrl pode ser path local ou URL; usamos como camadas de textura via CSS var */}
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: `url(${current.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
      <div className="relative z-10 w-full px-6 py-7 sm:px-12 sm:py-8 lg:px-20 lg:py-9">
        <p className="max-w-3xl text-xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
          {current.title || "CotaCondo"}
        </p>
      </div>
    </div>
  );

  const isExternal = Boolean(current.linkUrl?.startsWith("http"));

  return (
    <section
      className="relative w-full"
      aria-roledescription="carousel"
      aria-label="Banners CotaCondo"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          {current.linkUrl ? (
            isExternal ? (
              <a href={current.linkUrl} target="_blank" rel="noreferrer" className="block">
                {content}
              </a>
            ) : (
              <a href={current.linkUrl} className="block">
                {content}
              </a>
            )
          ) : (
            content
          )}
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Banner anterior"
            className="absolute top-1/2 left-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-md transition hover:bg-black/40 sm:left-6"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Próximo banner"
            className="absolute top-1/2 right-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-md transition hover:bg-black/40 sm:right-6"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Ir para banner ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
