"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Mascot } from "@/components/brand/Mascot";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 lg:pt-32 lg:pb-20">
      <div className="pointer-events-none absolute top-[8%] left-[6%] -z-10 h-[420px] w-[420px] rounded-full bg-[#A7115F]/[0.11] blur-[100px]" />
      <div className="pointer-events-none absolute right-[4%] bottom-[4%] -z-10 h-[380px] w-[380px] rounded-full bg-[#087F8C]/[0.1] blur-[120px]" />

      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-12">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5"
          >
            <h1 className="text-[36px] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#102A43] sm:text-[44px] lg:text-[52px]">
              A maior plataforma de inteligência de compras para o mercado condominial.
            </h1>
            <p className="mt-5 max-w-[480px] text-lg leading-relaxed tracking-[-0.01em] text-black/60">
              Centralize cotações, compare propostas com inteligência de dados e tome decisões
              seguras. Conecte seu condomínio a fornecedores validados com governança, compliance e
              rastreabilidade ponta a ponta.
            </p>
            <div id="cotacao" className="mt-8 flex flex-wrap items-center gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link href="/cadastro?tipo=sindico">
                  <Button size="lg" className="group pl-6 pr-2">
                    Fazer cotação
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#A7115F] transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Button>
                </Link>
              </motion.div>
              <Link
                href="/fornecedores"
                className="text-sm font-bold text-[#A7115F] transition-colors hover:text-[#8F0E52]"
              >
                Sou fornecedor
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center lg:col-span-7 lg:justify-end"
          >
            <Mascot priority className="relative z-10 max-w-[460px]" />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
