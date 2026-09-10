import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Container";

type PublicFooterProps = {
  blogUrl: string;
  whatsappUrl: string;
  description?: string;
};

export function PublicFooter({
  blogUrl,
  whatsappUrl,
  description = "Facilitamos processos de compras unindo administradoras e síndicos com fornecedores qualificados.",
}: PublicFooterProps) {
  return (
    <footer className="border-t border-black/5 bg-white/70 py-12">
      <Container className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo className="h-10" />
          <p className="mt-4 max-w-sm text-sm text-[#6B7280]">{description}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold text-[#0A0A0A]">Produto</p>
            <ul className="mt-3 space-y-2 text-[#6B7280]">
              <li>
                <Link href="/#cotacao" className="hover:text-[#c10089]">
                  Fazer cotação
                </Link>
              </li>
              <li>
                <Link href="/#planos" className="hover:text-[#c10089]">
                  Planos
                </Link>
              </li>
              <li>
                <Link href="/fornecedores" className="hover:text-[#c10089]">
                  Para Fornecedores
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-[#0A0A0A]">Acesso</p>
            <ul className="mt-3 space-y-2 text-[#6B7280]">
              <li>
                <Link href="/acesse" className="hover:text-[#c10089]">
                  Entrar
                </Link>
              </li>
              <li>
                <Link href="/cadastro" className="hover:text-[#c10089]">
                  Criar conta
                </Link>
              </li>
              <li>
                <a href={blogUrl} target="_blank" rel="noreferrer" className="hover:text-[#c10089]">
                  Blog
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-[#0A0A0A]">Contato</p>
            <ul className="mt-3 space-y-2 text-[#6B7280]">
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#c10089]"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>
      </Container>
      <Container className="mt-10">
        <p className="text-xs text-[#6B7280]">
          © {new Date().getFullYear()} CotaCondo. Todos os direitos reservados.
        </p>
      </Container>
    </footer>
  );
}
