import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

type WhatsAppCtaProps = {
  whatsappUrl: string;
  title?: string;
  description?: string;
};

export function WhatsAppCta({
  whatsappUrl,
  title = "Fale com um Consultor",
  description = "Ganhe segurança, agilidade e gestão. Mais que uma plataforma, somos a evolução que seu negócio precisa.",
}: WhatsAppCtaProps) {
  return (
    <section id="especialista" className="pb-20 lg:pb-24">
      <Container>
        <div className="overflow-hidden rounded-2xl border border-[#c10089]/20 bg-[#00535a] px-6 py-10 shadow-[0_24px_70px_-40px_rgba(16,42,67,0.8)] sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#F9A8D4]">
              Atendimento
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {title}
            </h2>
            <p className="mt-3 text-base text-white/65">{description}</p>
          </div>
          <Link href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-8 inline-block lg:mt-0">
            <Button size="lg" className="gap-2 bg-[#c10089] text-white hover:bg-[#9a006e]">
              <MessageCircle className="h-5 w-5" />
              Abrir WhatsApp
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
