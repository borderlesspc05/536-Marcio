import type { Metadata } from "next";
import { Suspense } from "react";
import { Poppins } from "next/font/google";
import { NavigationProgress } from "@/components/app/NavigationProgress";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CotaCondo",
    template: "%s · CotaCondo",
  },
  description:
    "Plataforma de cotações para condomínios — solicitantes e fornecedores em um fluxo 100% digital.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className={`${poppins.variable} font-sans antialiased`}>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
