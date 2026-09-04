"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Building2, FileCheck2, Handshake } from "lucide-react";
import { Container } from "@/components/ui/Container";

const steps = [
  { title: "Cadastro", text: "Cadastre sua empresa", icon: Building2 },
  { title: "Validação", text: "Envie seus documentos", icon: FileCheck2 },
  {
    title: "Oportunidades",
    text: "Receba, aceite e acompanhe oportunidades com síndicos e administradoras.",
    icon: Handshake,
  },
] as const;

export function SupplierHowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="pb-12" aria-labelledby="supplier-how-title">
      <Container>
        <div className="rounded-2xl border border-[#D9E2EC] bg-white/90 p-6 shadow-[0_20px_55px_-42px_rgba(16,42,67,0.75)] sm:p-8">
          <h2 id="supplier-how-title" className="text-2xl font-extrabold text-[#102A43]">
            Como funciona
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.title}
                  initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.55, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={reduceMotion ? undefined : { y: -5 }}
                  className="group relative overflow-hidden rounded-2xl border border-[#D9E2EC] bg-[#F7FAFC] p-5 transition-colors hover:border-[#A7115F]/30 hover:bg-[#FFF7FB]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#A7115F] text-white shadow-[0_10px_20px_-12px_rgba(167,17,95,0.8)]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-3xl font-extrabold text-[#A7115F]/15">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 font-bold text-[#102A43]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#526D82]">{item.text}</p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}
